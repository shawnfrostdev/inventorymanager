import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { socketService } from './socket.service';

const execAsync = promisify(exec);

export interface BackupConfig {
  enabled: boolean;
  schedule: {
    daily: string; // cron format
    weekly: string;
    monthly: string;
  };
  retention: {
    daily: number; // days
    weekly: number; // weeks
    monthly: number; // months
  };
  storage: {
    local: {
      enabled: boolean;
      path: string;
    };
    cloud: {
      enabled: boolean;
      provider: 'aws' | 'gcs' | 'azure';
      bucket: string;
      credentials?: any;
    };
  };
  compression: boolean;
  encryption: boolean;
}

export interface BackupInfo {
  id: string;
  type: 'database' | 'files' | 'full';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  size?: number;
  location: string;
  error?: string;
  metadata: {
    version: string;
    environment: string;
    tables?: string[];
    checksum?: string;
  };
}

class BackupService {
  private backupHistory: BackupInfo[] = [];
  private readonly maxHistorySize = 100;
  private scheduleIntervals: NodeJS.Timeout[] = [];
  
  private config: BackupConfig = {
    enabled: true,
    schedule: {
      daily: '0 2 * * *', // 2 AM daily
      weekly: '0 3 * * 0', // 3 AM on Sundays
      monthly: '0 4 1 * *', // 4 AM on 1st of month
    },
    retention: {
      daily: 7,
      weekly: 4,
      monthly: 12,
    },
    storage: {
      local: {
        enabled: true,
        path: path.join(process.cwd(), 'backups'),
      },
      cloud: {
        enabled: false,
        provider: 'aws',
        bucket: '',
      },
    },
    compression: true,
    encryption: false,
  };

  constructor() {
    this.ensureBackupDirectory();
    this.startScheduler();
  }

  // Start the backup scheduler
  startScheduler(): void {
    if (!this.config.enabled) {
      logger.info('Backup system is disabled');
      return;
    }

    // For simplicity, we'll implement basic interval scheduling
    // In production, use a proper cron library like node-cron
    
    // Daily backup every 24 hours
    const dailyInterval = setInterval(() => {
      this.createBackup('database', 'daily');
    }, 24 * 60 * 60 * 1000);

    // Weekly backup every 7 days
    const weeklyInterval = setInterval(() => {
      this.createBackup('full', 'weekly');
    }, 7 * 24 * 60 * 60 * 1000);

    this.scheduleIntervals.push(dailyInterval, weeklyInterval);
    
    logger.info('Backup scheduler started', {
      dailyBackup: this.config.schedule.daily,
      weeklyBackup: this.config.schedule.weekly,
    });
  }

  // Stop the backup scheduler
  stopScheduler(): void {
    this.scheduleIntervals.forEach(interval => clearInterval(interval));
    this.scheduleIntervals = [];
    logger.info('Backup scheduler stopped');
  }

  // Create a backup
  async createBackup(
    type: 'database' | 'files' | 'full',
    source: 'manual' | 'daily' | 'weekly' | 'monthly' = 'manual'
  ): Promise<BackupInfo> {
    const backupId = this.generateBackupId();
    const timestamp = new Date();
    
    const backupInfo: BackupInfo = {
      id: backupId,
      type,
      status: 'pending',
      startTime: timestamp,
      location: '',
      metadata: {
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
    };

    this.backupHistory.push(backupInfo);
    
    try {
      logger.info('Starting backup', { backupId, type, source });
      
      // Update status to running
      backupInfo.status = 'running';
      
      // Send real-time notification
      socketService.emitSystemAlert({
        type: 'info',
        message: `Backup started: ${type} backup (${backupId})`,
        data: { backupId, type, source },
      });

      // Perform the actual backup
      let location: string;
      let size: number;

      switch (type) {
        case 'database':
          ({ location, size } = await this.backupDatabase(backupId));
          break;
        case 'files':
          ({ location, size } = await this.backupFiles(backupId));
          break;
        case 'full':
          ({ location, size } = await this.backupFull(backupId));
          break;
        default:
          throw new Error(`Unknown backup type: ${type}`);
      }

      // Generate checksum
      const checksum = await this.generateChecksum(location);

      // Update backup info
      backupInfo.status = 'completed';
      backupInfo.endTime = new Date();
      backupInfo.location = location;
      backupInfo.size = size;
      backupInfo.metadata.checksum = checksum;

      // Upload to cloud if enabled
      if (this.config.storage.cloud.enabled) {
        await this.uploadToCloud(location, backupId);
      }

      // Clean up old backups
      await this.cleanupOldBackups();

      logger.info('Backup completed successfully', {
        backupId,
        type,
        size,
        duration: backupInfo.endTime.getTime() - backupInfo.startTime.getTime(),
      });

      // Send completion notification
      socketService.emitSystemAlert({
        type: 'success',
        message: `Backup completed: ${type} backup (${this.formatBytes(size)})`,
        data: { backupId, type, size, location },
      });

    } catch (error) {
      backupInfo.status = 'failed';
      backupInfo.endTime = new Date();
      backupInfo.error = error instanceof Error ? error.message : String(error);

      logger.error('Backup failed', {
        backupId,
        type,
        error: backupInfo.error,
      });

      // Send failure notification
      socketService.emitSystemAlert({
        type: 'error',
        message: `Backup failed: ${type} backup (${backupInfo.error})`,
        data: { backupId, type, error: backupInfo.error },
      });
    }

    // Clean up history
    if (this.backupHistory.length > this.maxHistorySize) {
      this.backupHistory = this.backupHistory.slice(-this.maxHistorySize);
    }

    return backupInfo;
  }

  // Backup database
  private async backupDatabase(backupId: string): Promise<{ location: string; size: number }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `db_backup_${backupId}_${timestamp}.sql`;
    const location = path.join(this.config.storage.local.path, filename);

    // Use pg_dump for PostgreSQL or mysqldump for MySQL
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    let command: string;
    if (databaseUrl.includes('postgresql://')) {
      command = `pg_dump "${databaseUrl}" > "${location}"`;
    } else if (databaseUrl.includes('mysql://')) {
      // Parse MySQL URL to extract credentials
      const url = new URL(databaseUrl);
      command = `mysqldump -h ${url.hostname} -P ${url.port || 3306} -u ${url.username} -p${url.password} ${url.pathname.slice(1)} > "${location}"`;
    } else {
      throw new Error('Unsupported database type');
    }

    await execAsync(command);

    // Compress if enabled
    if (this.config.compression) {
      const compressedLocation = `${location}.gz`;
      await execAsync(`gzip "${location}"`);
      const stats = await fs.promises.stat(compressedLocation);
      return { location: compressedLocation, size: stats.size };
    }

    const stats = await fs.promises.stat(location);
    return { location, size: stats.size };
  }

  // Backup files
  private async backupFiles(backupId: string): Promise<{ location: string; size: number }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `files_backup_${backupId}_${timestamp}.tar.gz`;
    const location = path.join(this.config.storage.local.path, filename);

    // Backup important application files
    const filesToBackup = [
      'uploads',
      'logs',
      'config',
      '.env',
    ].filter(file => fs.existsSync(file));

    if (filesToBackup.length === 0) {
      throw new Error('No files found to backup');
    }

    const command = `tar -czf "${location}" ${filesToBackup.join(' ')}`;
    await execAsync(command);

    const stats = await fs.promises.stat(location);
    return { location, size: stats.size };
  }

  // Full backup (database + files)
  private async backupFull(backupId: string): Promise<{ location: string; size: number }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `full_backup_${backupId}_${timestamp}.tar.gz`;
    const location = path.join(this.config.storage.local.path, filename);

    // Create database backup first
    const dbBackup = await this.backupDatabase(`${backupId}_db`);
    
    // Create files to backup list
    const filesToBackup = [
      'uploads',
      'logs',
      'config',
      '.env',
      dbBackup.location,
    ].filter(file => fs.existsSync(file));

    const command = `tar -czf "${location}" ${filesToBackup.join(' ')}`;
    await execAsync(command);

    // Clean up temporary database backup
    await fs.promises.unlink(dbBackup.location);

    const stats = await fs.promises.stat(location);
    return { location, size: stats.size };
  }

  // Restore from backup
  async restoreBackup(backupId: string): Promise<boolean> {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    if (backup.status !== 'completed') {
      throw new Error(`Cannot restore incomplete backup: ${backupId}`);
    }

    try {
      logger.info('Starting backup restoration', { backupId });

      // Send notification
      socketService.emitSystemAlert({
        type: 'warning',
        message: `Starting restoration from backup: ${backupId}`,
        data: { backupId, type: backup.type },
      });

      switch (backup.type) {
        case 'database':
          await this.restoreDatabase(backup.location);
          break;
        case 'files':
          await this.restoreFiles(backup.location);
          break;
        case 'full':
          await this.restoreFull(backup.location);
          break;
      }

      logger.info('Backup restoration completed', { backupId });
      
      // Send completion notification
      socketService.emitSystemAlert({
        type: 'success',
        message: `Backup restoration completed: ${backupId}`,
        data: { backupId },
      });

      return true;
    } catch (error) {
      logger.error('Backup restoration failed', {
        backupId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Send failure notification
      socketService.emitSystemAlert({
        type: 'error',
        message: `Backup restoration failed: ${backupId}`,
        data: { backupId, error: error instanceof Error ? error.message : String(error) },
      });

      return false;
    }
  }

  // Restore database
  private async restoreDatabase(location: string): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    // Decompress if needed
    let actualLocation = location;
    if (location.endsWith('.gz')) {
      actualLocation = location.replace('.gz', '');
      await execAsync(`gunzip -c "${location}" > "${actualLocation}"`);
    }

    let command: string;
    if (databaseUrl.includes('postgresql://')) {
      command = `psql "${databaseUrl}" < "${actualLocation}"`;
    } else if (databaseUrl.includes('mysql://')) {
      const url = new URL(databaseUrl);
      command = `mysql -h ${url.hostname} -P ${url.port || 3306} -u ${url.username} -p${url.password} ${url.pathname.slice(1)} < "${actualLocation}"`;
    } else {
      throw new Error('Unsupported database type');
    }

    await execAsync(command);

    // Clean up decompressed file if we created it
    if (location !== actualLocation) {
      await fs.promises.unlink(actualLocation);
    }
  }

  // Restore files
  private async restoreFiles(location: string): Promise<void> {
    const command = `tar -xzf "${location}" -C /`;
    await execAsync(command);
  }

  // Restore full backup
  private async restoreFull(location: string): Promise<void> {
    // Extract to temporary directory first
    const tempDir = path.join(this.config.storage.local.path, 'temp_restore');
    await fs.promises.mkdir(tempDir, { recursive: true });

    try {
      const command = `tar -xzf "${location}" -C "${tempDir}"`;
      await execAsync(command);

      // Find and restore database backup
      const files = await fs.promises.readdir(tempDir);
      const dbFile = files.find(f => f.includes('db_backup') && f.endsWith('.sql'));
      
      if (dbFile) {
        await this.restoreDatabase(path.join(tempDir, dbFile));
      }

      // Restore other files
      const filesToRestore = files.filter(f => !f.includes('db_backup'));
      for (const file of filesToRestore) {
        const sourcePath = path.join(tempDir, file);
        const targetPath = path.join(process.cwd(), file);
        
        // Copy file/directory
        const stats = await fs.promises.stat(sourcePath);
        if (stats.isDirectory()) {
          await execAsync(`cp -r "${sourcePath}" "${targetPath}"`);
        } else {
          await fs.promises.copyFile(sourcePath, targetPath);
        }
      }
    } finally {
      // Clean up temp directory
      await execAsync(`rm -rf "${tempDir}"`);
    }
  }

  // Generate checksum for backup file
  private async generateChecksum(location: string): Promise<string> {
    const { stdout } = await execAsync(`sha256sum "${location}"`);
    return stdout.split(' ')[0];
  }

  // Upload backup to cloud storage
  private async uploadToCloud(location: string, backupId: string): Promise<void> {
    // This is a placeholder - implement actual cloud upload based on provider
    logger.info('Cloud upload would happen here', { location, backupId });
    
    // For AWS S3:
    // aws s3 cp "${location}" "s3://${bucket}/backups/${backupId}"
    
    // For Google Cloud Storage:
    // gsutil cp "${location}" "gs://${bucket}/backups/${backupId}"
    
    // For Azure:
    // az storage blob upload --file "${location}" --container backups --name "${backupId}"
  }

  // Clean up old backups based on retention policy
  private async cleanupOldBackups(): Promise<void> {
    const now = new Date();
    const backupsToDelete: string[] = [];

    for (const backup of this.backupHistory) {
      if (backup.status !== 'completed' || !backup.location) continue;

      const age = now.getTime() - backup.startTime.getTime();
      const ageInDays = age / (1000 * 60 * 60 * 24);

      let shouldDelete = false;

      // Check retention based on backup frequency
      if (backup.location.includes('daily') && ageInDays > this.config.retention.daily) {
        shouldDelete = true;
      } else if (backup.location.includes('weekly') && ageInDays > (this.config.retention.weekly * 7)) {
        shouldDelete = true;
      } else if (backup.location.includes('monthly') && ageInDays > (this.config.retention.monthly * 30)) {
        shouldDelete = true;
      }

      if (shouldDelete && fs.existsSync(backup.location)) {
        backupsToDelete.push(backup.location);
      }
    }

    // Delete old backup files
    for (const backupPath of backupsToDelete) {
      try {
        await fs.promises.unlink(backupPath);
        logger.info('Deleted old backup', { backupPath });
      } catch (error) {
        logger.warn('Failed to delete old backup', { 
          backupPath, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    // Remove from history
    this.backupHistory = this.backupHistory.filter(b => 
      !backupsToDelete.includes(b.location)
    );
  }

  // Ensure backup directory exists
  private ensureBackupDirectory(): void {
    const backupDir = this.config.storage.local.path;
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      logger.info('Created backup directory', { path: backupDir });
    }
  }

  // Generate unique backup ID
  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Format bytes to human readable format
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get backup history
  getBackupHistory(): BackupInfo[] {
    return [...this.backupHistory].sort((a, b) => 
      b.startTime.getTime() - a.startTime.getTime()
    );
  }

  // Get backup statistics
  getBackupStats(): {
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    totalSize: number;
    lastBackup?: BackupInfo;
    nextScheduledBackup: Date;
  } {
    const totalBackups = this.backupHistory.length;
    const successfulBackups = this.backupHistory.filter(b => b.status === 'completed').length;
    const failedBackups = this.backupHistory.filter(b => b.status === 'failed').length;
    const totalSize = this.backupHistory
      .filter(b => b.status === 'completed' && b.size)
      .reduce((sum, b) => sum + (b.size || 0), 0);

    const lastBackup = this.backupHistory
      .filter(b => b.status === 'completed')
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];

    // Calculate next scheduled backup (simplified - assume daily)
    const nextScheduledBackup = new Date();
    nextScheduledBackup.setDate(nextScheduledBackup.getDate() + 1);
    nextScheduledBackup.setHours(2, 0, 0, 0); // 2 AM

    return {
      totalBackups,
      successfulBackups,
      failedBackups,
      totalSize,
      lastBackup,
      nextScheduledBackup,
    };
  }

  // Update backup configuration
  updateConfig(newConfig: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart scheduler if enabled status changed
    this.stopScheduler();
    if (this.config.enabled) {
      this.startScheduler();
    }

    logger.info('Backup configuration updated', { config: this.config });
  }

  // Get current configuration
  getConfig(): BackupConfig {
    return { ...this.config };
  }

  // Health check for backup system
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    details: {
      lastBackupAge: number | null;
      failureRate: number;
      diskSpace: string;
      schedulerRunning: boolean;
    };
  } {
    const stats = this.getBackupStats();
    const lastBackupAge = stats.lastBackup 
      ? Date.now() - stats.lastBackup.startTime.getTime()
      : null;

    const failureRate = stats.totalBackups > 0 
      ? (stats.failedBackups / stats.totalBackups) * 100 
      : 0;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Critical: No backup in 48 hours or high failure rate
    if ((lastBackupAge && lastBackupAge > 48 * 60 * 60 * 1000) || failureRate > 50) {
      status = 'critical';
    }
    // Warning: No backup in 24 hours or moderate failure rate
    else if ((lastBackupAge && lastBackupAge > 24 * 60 * 60 * 1000) || failureRate > 20) {
      status = 'warning';
    }

    return {
      status,
      details: {
        lastBackupAge: lastBackupAge ? Math.round(lastBackupAge / (1000 * 60 * 60)) : null, // hours
        failureRate: Math.round(failureRate * 100) / 100,
        diskSpace: this.formatBytes(stats.totalSize),
        schedulerRunning: this.scheduleIntervals.length > 0,
      },
    };
  }
}

// Export singleton instance
export const backupService = new BackupService(); 