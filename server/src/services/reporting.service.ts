import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { socketService } from './socket.service';
import { cacheService } from './cache.service';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'sales' | 'inventory' | 'financial' | 'customer' | 'supplier' | 'custom';
  category: string;
  parameters: ReportParameter[];
  query: string;
  visualization: VisualizationConfig;
  schedule?: ScheduleConfig;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportParameter {
  name: string;
  type: 'date' | 'dateRange' | 'number' | 'string' | 'select' | 'multiSelect';
  label: string;
  required: boolean;
  defaultValue?: any;
  options?: Array<{ value: any; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface VisualizationConfig {
  type: 'table' | 'chart' | 'graph' | 'dashboard';
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  groupBy?: string[];
  aggregations?: Array<{
    field: string;
    function: 'sum' | 'count' | 'avg' | 'min' | 'max';
    alias: string;
  }>;
  formatting?: {
    currency?: boolean;
    percentage?: boolean;
    decimal?: number;
  };
}

export interface ScheduleConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string; // HH:MM format
  timezone: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv' | 'json';
}

export interface ReportResult {
  id: string;
  templateId: string;
  name: string;
  data: any[];
  metadata: {
    generatedAt: Date;
    parameters: Record<string, any>;
    recordCount: number;
    executionTime: number;
    dataRange?: {
      from: Date;
      to: Date;
    };
  };
  visualization: VisualizationConfig;
}

export interface ReportExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'json';
  includeCharts: boolean;
  includeSummary: boolean;
  customStyling?: any;
}

class ReportingService {
  private templates: Map<string, ReportTemplate> = new Map();
  private reports: Map<string, ReportResult> = new Map();
  private scheduleJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
    this.startScheduleProcessor();
  }

  // Initialize default report templates
  private async initializeDefaultTemplates(): Promise<void> {
    const defaultTemplates: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Sales Summary Report',
        description: 'Monthly sales performance overview',
        type: 'sales',
        category: 'Performance',
        parameters: [
          {
            name: 'dateRange',
            type: 'dateRange',
            label: 'Date Range',
            required: true,
            defaultValue: { start: new Date(Date.now() - 30*24*60*60*1000), end: new Date() }
          },
          {
            name: 'includeDetails',
            type: 'select',
            label: 'Include Details',
            required: false,
            defaultValue: 'summary',
            options: [
              { value: 'summary', label: 'Summary Only' },
              { value: 'detailed', label: 'Detailed View' }
            ]
          }
        ],
        query: `
          SELECT 
            DATE(o.createdAt) as date,
            COUNT(*) as orderCount,
                    SUM(o.total) as totalSales,
        AVG(o.total) as avgOrderValue,
            COUNT(DISTINCT o.customerId) as uniqueCustomers
          FROM orders o 
          WHERE o.createdAt BETWEEN :startDate AND :endDate
          GROUP BY DATE(o.createdAt)
          ORDER BY date DESC
        `,
        visualization: {
          type: 'chart',
          chartType: 'line',
          groupBy: ['date'],
          aggregations: [
            { field: 'totalSales', function: 'sum', alias: 'Total Sales' },
            { field: 'orderCount', function: 'sum', alias: 'Orders' }
          ],
          formatting: { currency: true }
        },
        isActive: true,
        createdBy: 'system'
      },
      {
        name: 'Inventory Levels Report',
        description: 'Current stock levels and low stock alerts',
        type: 'inventory',
        category: 'Stock Management',
        parameters: [
          {
            name: 'locationId',
            type: 'select',
            label: 'Location',
            required: false,
            defaultValue: 'all'
          },
          {
            name: 'stockThreshold',
            type: 'number',
            label: 'Low Stock Threshold',
            required: false,
            defaultValue: 10,
            validation: { min: 0 }
          }
        ],
        query: `
          SELECT 
            p.name as productName,
            p.sku,
            c.name as category,
            SUM(ps.quantity) as totalStock,
            p.reorderLevel,
            CASE 
              WHEN SUM(ps.quantity) <= p.reorderLevel THEN 'Low Stock'
              WHEN SUM(ps.quantity) <= (p.reorderLevel * 1.5) THEN 'Warning'
              ELSE 'Adequate'
            END as stockStatus
          FROM products p
          LEFT JOIN product_stocks ps ON p.id = ps.productId
          LEFT JOIN categories c ON p.categoryId = c.id
          WHERE (:locationId = 'all' OR ps.locationId = :locationId)
          GROUP BY p.id, p.name, p.sku, c.name, p.reorderLevel
          ORDER BY totalStock ASC
        `,
        visualization: {
          type: 'table',
          formatting: { decimal: 0 }
        },
        isActive: true,
        createdBy: 'system'
      },
      {
        name: 'Financial Performance Report',
        description: 'Revenue, costs, and profit analysis',
        type: 'financial',
        category: 'Finance',
        parameters: [
          {
            name: 'period',
            type: 'select',
            label: 'Period',
            required: true,
            defaultValue: 'month',
            options: [
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: 'quarter', label: 'This Quarter' },
              { value: 'year', label: 'This Year' }
            ]
          }
        ],
        query: `
          SELECT 
            DATE_TRUNC(:period, o.createdAt) as period,
            SUM(o.total) as revenue,
            SUM(oi.quantity * p.cost) as cogs,
            SUM(o.total) - SUM(oi.quantity * p.cost) as grossProfit,
            (SUM(o.total) - SUM(oi.quantity * p.cost)) / NULLIF(SUM(o.total), 0) * 100 as marginPercent
          FROM orders o
          JOIN order_items oi ON o.id = oi.orderId
          JOIN products p ON oi.productId = p.id
          WHERE o.status = 'completed'
          GROUP BY DATE_TRUNC(:period, o.createdAt)
          ORDER BY period DESC
        `,
        visualization: {
          type: 'chart',
          chartType: 'bar',
          groupBy: ['period'],
          aggregations: [
            { field: 'revenue', function: 'sum', alias: 'Revenue' },
            { field: 'grossProfit', function: 'sum', alias: 'Gross Profit' }
          ],
          formatting: { currency: true }
        },
        isActive: true,
        createdBy: 'system'
      },
      {
        name: 'Customer Analysis Report',
        description: 'Customer behavior and segmentation analysis',
        type: 'customer',
        category: 'Customer Insights',
        parameters: [
          {
            name: 'segment',
            type: 'select',
            label: 'Customer Segment',
            required: false,
            defaultValue: 'all',
            options: [
              { value: 'all', label: 'All Customers' },
              { value: 'new', label: 'New Customers' },
              { value: 'returning', label: 'Returning Customers' },
              { value: 'vip', label: 'VIP Customers' }
            ]
          }
        ],
        query: `
          SELECT 
            u.email,
            u.name,
            COUNT(o.id) as totalOrders,
            SUM(o.total) as totalSpent,
            AVG(o.total) as avgOrderValue,
            MAX(o.createdAt) as lastOrderDate,
            CASE 
              WHEN SUM(o.total) > 10000 THEN 'VIP'
              WHEN COUNT(o.id) > 5 THEN 'Regular'
              ELSE 'New'
            END as customerSegment
          FROM users u
          LEFT JOIN orders o ON u.id = o.customerId
          WHERE u.role = 'customer'
          GROUP BY u.id, u.email, u.name
          ORDER BY totalSpent DESC
        `,
        visualization: {
          type: 'table',
          formatting: { currency: true, decimal: 2 }
        },
        isActive: true,
        createdBy: 'system'
      }
    ];

    for (const template of defaultTemplates) {
      const id = this.generateTemplateId();
      const fullTemplate: ReportTemplate = {
        ...template,
        id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.templates.set(id, fullTemplate);
    }

    logger.info('Default report templates initialized', { count: defaultTemplates.length });
  }

  // Create a new report template
  async createTemplate(
    templateData: Omit<ReportTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<ReportTemplate> {
    const id = this.generateTemplateId();
    const template: ReportTemplate = {
      ...templateData,
      id,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(id, template);

    // Schedule if needed
    if (template.schedule) {
      this.scheduleReport(template);
    }

    logger.info('Report template created', { templateId: id, name: template.name });

    // Send real-time notification
    socketService.emitSystemAlert({
      type: 'info',
      message: `New report template created: ${template.name}`,
      data: { templateId: id, templateName: template.name }
    });

    return template;
  }

  // Generate a report from template
  async generateReport(
    templateId: string,
    parameters: Record<string, any>,
    userId: string
  ): Promise<ReportResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Report template not found: ${templateId}`);
    }

    const startTime = Date.now();
    const reportId = this.generateReportId();

    try {
      // Validate parameters
      this.validateParameters(template.parameters, parameters);

      // Execute query with parameters
      const data = await this.executeQuery(template.query, parameters);

      // Create report result
      const report: ReportResult = {
        id: reportId,
        templateId,
        name: `${template.name} - ${new Date().toLocaleDateString()}`,
        data,
        metadata: {
          generatedAt: new Date(),
          parameters,
          recordCount: data.length,
          executionTime: Date.now() - startTime,
          dataRange: this.extractDateRange(parameters)
        },
        visualization: template.visualization
      };

      // Cache the report
      await cacheService.set(`report:${reportId}`, report, 3600); // 1 hour cache
      this.reports.set(reportId, report);

      logger.info('Report generated successfully', {
        reportId,
        templateId,
        recordCount: data.length,
        executionTime: Date.now() - startTime
      });

      // Send real-time notification
      socketService.emitSystemAlert({
        type: 'success',
        message: `Report generated: ${template.name}`,
        data: { reportId, templateId, recordCount: data.length }
      });

      return report;
    } catch (error) {
      logger.error('Report generation failed', {
        templateId,
        parameters,
        error: error instanceof Error ? error.message : String(error)
      });

      // Send error notification
      socketService.emitSystemAlert({
        type: 'error',
        message: `Report generation failed: ${template.name}`,
        data: { templateId, error: error instanceof Error ? error.message : String(error) }
      });

      throw error;
    }
  }

  // Execute database query with parameters
  private async executeQuery(query: string, parameters: Record<string, any>): Promise<any[]> {
    // Replace parameters in query
    let processedQuery = query;
    for (const [key, value] of Object.entries(parameters)) {
      const paramPattern = new RegExp(`:${key}\\b`, 'g');
      
      if (value instanceof Date) {
        processedQuery = processedQuery.replace(paramPattern, `'${value.toISOString()}'`);
      } else if (typeof value === 'string') {
        processedQuery = processedQuery.replace(paramPattern, `'${value}'`);
      } else {
        processedQuery = processedQuery.replace(paramPattern, String(value));
      }
    }

    // Execute raw query using Prisma
    const result = await prisma.$queryRawUnsafe(processedQuery);
    return Array.isArray(result) ? result : [result];
  }

  // Validate report parameters
  private validateParameters(templateParams: ReportParameter[], actualParams: Record<string, any>): void {
    for (const param of templateParams) {
      if (param.required && !(param.name in actualParams)) {
        throw new Error(`Required parameter missing: ${param.name}`);
      }

      const value = actualParams[param.name];
      if (value !== undefined && param.validation) {
        if (param.validation.min !== undefined && value < param.validation.min) {
          throw new Error(`Parameter ${param.name} must be >= ${param.validation.min}`);
        }
        if (param.validation.max !== undefined && value > param.validation.max) {
          throw new Error(`Parameter ${param.name} must be <= ${param.validation.max}`);
        }
        if (param.validation.pattern && !new RegExp(param.validation.pattern).test(value)) {
          throw new Error(`Parameter ${param.name} does not match required pattern`);
        }
      }
    }
  }

  // Export report to various formats
  async exportReport(
    reportId: string,
    options: ReportExportOptions
  ): Promise<{ filePath: string; fileName: string }> {
    const report = this.reports.get(reportId) || await cacheService.get(`report:${reportId}`);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${report.name}_${timestamp}.${options.format}`;
    const filePath = path.join(process.cwd(), 'exports', fileName);

    // Ensure exports directory exists
    const exportDir = path.dirname(filePath);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    try {
      switch (options.format) {
        case 'json':
          await this.exportToJSON(report, filePath, options);
          break;
        case 'csv':
          await this.exportToCSV(report, filePath, options);
          break;
        case 'excel':
          await this.exportToExcel(report, filePath, options);
          break;
        case 'pdf':
          await this.exportToPDF(report, filePath, options);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      logger.info('Report exported successfully', {
        reportId,
        format: options.format,
        fileName,
        recordCount: report.data.length
      });

      return { filePath, fileName };
    } catch (error) {
      logger.error('Report export failed', {
        reportId,
        format: options.format,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Export to JSON
  private async exportToJSON(
    report: ReportResult,
    filePath: string,
    options: ReportExportOptions
  ): Promise<void> {
    const exportData = {
      report: {
        name: report.name,
        generatedAt: report.metadata.generatedAt,
        recordCount: report.metadata.recordCount
      },
      data: report.data,
      ...(options.includeSummary && {
        summary: this.generateSummary(report.data)
      })
    };

    await fs.promises.writeFile(filePath, JSON.stringify(exportData, null, 2));
  }

  // Export to CSV
  private async exportToCSV(
    report: ReportResult,
    filePath: string,
    options: ReportExportOptions
  ): Promise<void> {
    if (report.data.length === 0) {
      await fs.promises.writeFile(filePath, 'No data available');
      return;
    }

    const headers = Object.keys(report.data[0]);
    const csvContent = [
      headers.join(','),
      ...report.data.map(row =>
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    await fs.promises.writeFile(filePath, csvContent);
  }

  // Export to Excel (simplified - would use a library like xlsx in production)
  private async exportToExcel(
    report: ReportResult,
    filePath: string,
    options: ReportExportOptions
  ): Promise<void> {
    // This is a placeholder - in production, use libraries like 'xlsx' or 'exceljs'
    await this.exportToCSV(report, filePath.replace('.excel', '.csv'), options);
    logger.info('Excel export converted to CSV format');
  }

  // Export to PDF (simplified - would use a library like puppeteer in production)
  private async exportToPDF(
    report: ReportResult,
    filePath: string,
    options: ReportExportOptions
  ): Promise<void> {
    // This is a placeholder - in production, use libraries like 'puppeteer' or 'pdfkit'
    const htmlContent = this.generateHTMLReport(report, options);
    await fs.promises.writeFile(filePath.replace('.pdf', '.html'), htmlContent);
    logger.info('PDF export converted to HTML format');
  }

  // Generate HTML report
  private generateHTMLReport(report: ReportResult, options: ReportExportOptions): string {
    const tableRows = report.data.map(row =>
      `<tr>${Object.values(row).map(cell => `<td>${cell}</td>`).join('')}</tr>`
    ).join('');

    const tableHeaders = report.data.length > 0
      ? `<tr>${Object.keys(report.data[0]).map(header => `<th>${header}</th>`).join('')}</tr>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .header { margin-bottom: 20px; }
          .summary { margin: 20px 0; padding: 10px; background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${report.name}</h1>
          <p>Generated: ${report.metadata.generatedAt.toLocaleString()}</p>
          <p>Records: ${report.metadata.recordCount}</p>
        </div>
        ${options.includeSummary ? `<div class="summary">${JSON.stringify(this.generateSummary(report.data), null, 2)}</div>` : ''}
        <table>
          ${tableHeaders}
          ${tableRows}
        </table>
      </body>
      </html>
    `;
  }

  // Generate data summary
  private generateSummary(data: any[]): any {
    if (data.length === 0) return { message: 'No data available' };

    const numericFields = Object.keys(data[0]).filter(key =>
      typeof data[0][key] === 'number'
    );

    const summary: any = {
      totalRecords: data.length
    };

    for (const field of numericFields) {
      const values = data.map(row => row[field]).filter(val => typeof val === 'number');
      if (values.length > 0) {
        summary[field] = {
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    }

    return summary;
  }

  // Schedule report generation
  private scheduleReport(template: ReportTemplate): void {
    if (!template.schedule) return;

    const scheduleKey = `schedule:${template.id}`;
    
    // Clear existing schedule
    const existingJob = this.scheduleJobs.get(scheduleKey);
    if (existingJob) {
      clearInterval(existingJob);
    }

    // Calculate interval based on frequency
    let intervalMs: number;
    switch (template.schedule.frequency) {
      case 'daily':
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      case 'weekly':
        intervalMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'monthly':
        intervalMs = 30 * 24 * 60 * 60 * 1000;
        break;
      case 'quarterly':
        intervalMs = 90 * 24 * 60 * 60 * 1000;
        break;
      default:
        intervalMs = 24 * 60 * 60 * 1000;
    }

    // Create scheduled job
    const job = setInterval(async () => {
      try {
        const defaultParams = this.getDefaultParameters(template.parameters);
        const report = await this.generateReport(template.id, defaultParams, template.createdBy);
        
        // Export and send to recipients
        if (template.schedule) {
          const exportResult = await this.exportReport(report.id, {
            format: template.schedule.format,
            includeCharts: true,
            includeSummary: true
          });

          // Send notifications to recipients
          for (const recipient of template.schedule.recipients) {
            socketService.emitToUser(recipient, 'scheduledReport', {
              templateName: template.name,
              reportId: report.id,
              fileName: exportResult.fileName,
              recordCount: report.metadata.recordCount
            });
          }

          logger.info('Scheduled report generated and sent', {
            templateId: template.id,
            recipients: template.schedule.recipients.length,
            recordCount: report.metadata.recordCount
          });
        }
      } catch (error) {
        logger.error('Scheduled report generation failed', {
          templateId: template.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, intervalMs);

    this.scheduleJobs.set(scheduleKey, job);
    logger.info('Report scheduled', { templateId: template.id, frequency: template.schedule.frequency });
  }

  // Get default parameters for template
  private getDefaultParameters(parameters: ReportParameter[]): Record<string, any> {
    const defaults: Record<string, any> = {};
    
    for (const param of parameters) {
      if (param.defaultValue !== undefined) {
        defaults[param.name] = param.defaultValue;
      } else if (param.type === 'dateRange') {
        // Default to last 30 days
        defaults[param.name] = {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        };
      }
    }

    return defaults;
  }

  // Extract date range from parameters
  private extractDateRange(parameters: Record<string, any>): { from: Date; to: Date } | undefined {
    for (const [key, value] of Object.entries(parameters)) {
      if (value && typeof value === 'object' && value.start && value.end) {
        return { from: new Date(value.start), to: new Date(value.end) };
      }
    }
    return undefined;
  }

  // Start schedule processor
  private startScheduleProcessor(): void {
    // Process existing templates for scheduling
    for (const template of this.templates.values()) {
      if (template.schedule && template.isActive) {
        this.scheduleReport(template);
      }
    }

    logger.info('Report schedule processor started');
  }

  // Get all templates
  getTemplates(): ReportTemplate[] {
    return Array.from(this.templates.values());
  }

  // Get template by ID
  getTemplate(templateId: string): ReportTemplate | null {
    return this.templates.get(templateId) || null;
  }

  // Get recent reports
  getRecentReports(limit: number = 50): ReportResult[] {
    return Array.from(this.reports.values())
      .sort((a, b) => b.metadata.generatedAt.getTime() - a.metadata.generatedAt.getTime())
      .slice(0, limit);
  }

  // Get report by ID
  async getReport(reportId: string): Promise<ReportResult | null> {
    return this.reports.get(reportId) || await cacheService.get(`report:${reportId}`);
  }

  // Delete template
  deleteTemplate(templateId: string): boolean {
    const template = this.templates.get(templateId);
    if (!template) {
      return false;
    }

    // Clear scheduled job
    const scheduleKey = `schedule:${templateId}`;
    const job = this.scheduleJobs.get(scheduleKey);
    if (job) {
      clearInterval(job);
      this.scheduleJobs.delete(scheduleKey);
    }

    this.templates.delete(templateId);
    logger.info('Report template deleted', { templateId });
    return true;
  }

  // Generate template ID
  private generateTemplateId(): string {
    return `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate report ID
  private generateReportId(): string {
    return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get reporting statistics
  getReportingStats(): {
    totalTemplates: number;
    activeTemplates: number;
    scheduledTemplates: number;
    reportsGenerated: number;
    avgExecutionTime: number;
  } {
    const templates = Array.from(this.templates.values());
    const reports = Array.from(this.reports.values());

    const avgExecutionTime = reports.length > 0
      ? reports.reduce((sum, r) => sum + r.metadata.executionTime, 0) / reports.length
      : 0;

    return {
      totalTemplates: templates.length,
      activeTemplates: templates.filter(t => t.isActive).length,
      scheduledTemplates: templates.filter(t => t.schedule).length,
      reportsGenerated: reports.length,
      avgExecutionTime: Math.round(avgExecutionTime)
    };
  }
}

// Export singleton instance
export const reportingService = new ReportingService(); 