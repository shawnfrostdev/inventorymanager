import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import orderRoutes from './routes/order.routes';
import locationRoutes from './routes/location.routes';
import transferRoutes from './routes/transfer.routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { socketService } from './services/socket.service';

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api', orderRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/transfers', transferRoutes);

// Error handling
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
}); 