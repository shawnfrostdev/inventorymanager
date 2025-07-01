import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import orderRoutes from './routes/order.routes';
import locationRoutes from './routes/location.routes';
import transferRoutes from './routes/transfer.routes';
import reportsRoutes from './routes/reports.routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { socketService } from './services/socket.service';
import { errorTrackingService } from './services/errorTracking.service';
import { performanceMonitoringService } from './services/performanceMonitoring.service';
import { backupService } from './services/backup.service';
import { lazyLoadingService } from './services/lazyLoading.service';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Performance monitoring
app.use(performanceMonitoringService.middleware());

// Lazy loading pagination
app.use(lazyLoadingService.middleware());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api', orderRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/reports', reportsRoutes);

// Error handling
app.use(errorTrackingService.middleware());
app.use(errorHandler);

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Initialize Socket.IO
socketService.initialize(httpServer);

// Start server
httpServer.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
  logger.info(`CORS enabled for ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
  logger.info('Socket.IO server ready for real-time connections');
  logger.info('Performance monitoring active');
  logger.info('Error tracking system initialized');
  logger.info('Backup system ready');
  logger.info('Lazy loading service initialized');
  logger.info('🚀 Phase 7 optimization features fully activated!');
}); 