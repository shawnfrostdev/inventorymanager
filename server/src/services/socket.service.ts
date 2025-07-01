import { Server as HTTPServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { logger } from '../utils/logger';

export interface SocketUser {
  userId: string;
  userRole: string;
  socketId: string;
  joinedAt: Date;
}

export interface StockUpdateData {
  productId: string;
  productName: string;
  oldQuantity: number;
  newQuantity: number;
  locationId?: string;
  locationName?: string;
  updatedBy: string;
  timestamp: Date;
}

export interface OrderNotificationData {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  status: string;
  total: number;
  currency: string;
  action: 'created' | 'updated' | 'completed' | 'cancelled';
  updatedBy: string;
  timestamp: Date;
}

export interface InvoiceNotificationData {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  status: string;
  total: number;
  currency: string;
  action: 'created' | 'paid' | 'overdue' | 'cancelled';
  updatedBy: string;
  timestamp: Date;
}

export interface PaymentNotificationData {
  paymentId: string;
  paymentNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  method: string;
  customerId: string;
  customerName: string;
  timestamp: Date;
}

class SocketService {
  private io: SocketServer | null = null;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]

  // Initialize Socket.IO server
  initialize(httpServer: HTTPServer) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    logger.info('Socket.IO server initialized successfully');
  }

  // Setup event handlers
  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.info('New socket connection', { socketId: socket.id });

      // Handle user authentication
      socket.on('authenticate', (data: { userId: string; userRole: string }) => {
        this.authenticateUser(socket, data);
      });

      // Handle joining specific rooms
      socket.on('join-room', (roomName: string) => {
        socket.join(roomName);
        logger.info('User joined room', { socketId: socket.id, roomName });
      });

      // Handle leaving rooms
      socket.on('leave-room', (roomName: string) => {
        socket.leave(roomName);
        logger.info('User left room', { socketId: socket.id, roomName });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket.id, reason);
      });

      // Handle real-time chat messages (for future chat system)
      socket.on('chat-message', (data) => {
        this.handleChatMessage(socket, data);
      });

      // Handle manual refresh requests
      socket.on('request-dashboard-update', (userId: string) => {
        this.sendDashboardUpdate(userId);
      });
    });
  }

  // Authenticate user and store connection info
  private authenticateUser(socket: any, data: { userId: string; userRole: string }) {
    const user: SocketUser = {
      userId: data.userId,
      userRole: data.userRole,
      socketId: socket.id,
      joinedAt: new Date(),
    };

    this.connectedUsers.set(socket.id, user);

    // Track multiple sockets per user
    const userSocketIds = this.userSockets.get(data.userId) || [];
    userSocketIds.push(socket.id);
    this.userSockets.set(data.userId, userSocketIds);

    // Join user-specific room
    socket.join(`user-${data.userId}`);
    
    // Join role-specific room
    socket.join(`role-${data.userRole}`);

    logger.info('User authenticated', { 
      userId: data.userId, 
      userRole: data.userRole, 
      socketId: socket.id 
    });

    // Send confirmation
    socket.emit('authenticated', { status: 'success', userId: data.userId });

    // Send initial dashboard data
    this.sendDashboardUpdate(data.userId);
  }

  // Handle user disconnection
  private handleDisconnection(socketId: string, reason: string) {
    const user = this.connectedUsers.get(socketId);
    
    if (user) {
      // Remove from user sockets mapping
      const userSocketIds = this.userSockets.get(user.userId) || [];
      const filteredSockets = userSocketIds.filter(id => id !== socketId);
      
      if (filteredSockets.length > 0) {
        this.userSockets.set(user.userId, filteredSockets);
      } else {
        this.userSockets.delete(user.userId);
      }

      this.connectedUsers.delete(socketId);

      logger.info('User disconnected', { 
        userId: user.userId, 
        socketId, 
        reason,
        remainingSockets: filteredSockets.length
      });
    }
  }

  // Send real-time stock update notifications
  emitStockUpdate(stockUpdate: StockUpdateData, targetUserId?: string) {
    if (!this.io) return;

    logger.info('Broadcasting stock update', { 
      productId: stockUpdate.productId,
      targetUserId 
    });

    if (targetUserId) {
      // Send to specific user
      this.io.to(`user-${targetUserId}`).emit('stock-updated', stockUpdate);
    } else {
      // Send to all connected users
      this.io.emit('stock-updated', stockUpdate);
    }
  }

  // Send real-time order notifications
  emitOrderNotification(orderNotification: OrderNotificationData, targetUserId?: string) {
    if (!this.io) return;

    logger.info('Broadcasting order notification', { 
      orderId: orderNotification.orderId,
      action: orderNotification.action,
      targetUserId 
    });

    if (targetUserId) {
      this.io.to(`user-${targetUserId}`).emit('order-notification', orderNotification);
    } else {
      this.io.emit('order-notification', orderNotification);
    }
  }

  // Send real-time invoice notifications
  emitInvoiceNotification(invoiceNotification: InvoiceNotificationData, targetUserId?: string) {
    if (!this.io) return;

    logger.info('Broadcasting invoice notification', { 
      invoiceId: invoiceNotification.invoiceId,
      action: invoiceNotification.action,
      targetUserId 
    });

    if (targetUserId) {
      this.io.to(`user-${targetUserId}`).emit('invoice-notification', invoiceNotification);
    } else {
      this.io.emit('invoice-notification', invoiceNotification);
    }
  }

  // Send real-time payment notifications
  emitPaymentNotification(paymentNotification: PaymentNotificationData, targetUserId?: string) {
    if (!this.io) return;

    logger.info('Broadcasting payment notification', { 
      paymentId: paymentNotification.paymentId,
      targetUserId 
    });

    if (targetUserId) {
      this.io.to(`user-${targetUserId}`).emit('payment-notification', paymentNotification);
    } else {
      this.io.emit('payment-notification', paymentNotification);
    }
  }

  // Send dashboard updates
  async sendDashboardUpdate(userId: string) {
    if (!this.io) return;

    try {
      // This would integrate with your existing services to get dashboard data
      const dashboardData = {
        timestamp: new Date(),
        message: 'Dashboard data updated',
        // You can integrate with paymentReportsService.generateFinancialDashboard(userId) here
      };

      this.io.to(`user-${userId}`).emit('dashboard-update', dashboardData);
      
      logger.info('Dashboard update sent', { userId });
    } catch (error) {
      logger.error('Error sending dashboard update', { userId, error });
    }
  }

  // Handle chat messages (for future chat system)
  private handleChatMessage(socket: any, data: any) {
    const user = this.connectedUsers.get(socket.id);
    
    if (user) {
      const message = {
        id: Date.now().toString(),
        userId: user.userId,
        message: data.message,
        timestamp: new Date(),
        userRole: user.userRole,
      };

      // Broadcast to all users (you can modify this for specific rooms/channels)
      this.io?.emit('chat-message', message);
      
      logger.info('Chat message broadcasted', { 
        userId: user.userId, 
        messageLength: data.message?.length 
      });
    }
  }

  // Send system alerts
  emitSystemAlert(alert: { type: 'info' | 'warning' | 'error'; message: string; data?: any }, targetUserId?: string) {
    if (!this.io) return;

    const alertData = {
      ...alert,
      timestamp: new Date(),
      id: Date.now().toString(),
    };

    if (targetUserId) {
      this.io.to(`user-${targetUserId}`).emit('system-alert', alertData);
    } else {
      this.io.emit('system-alert', alertData);
    }

    logger.info('System alert sent', { 
      type: alert.type, 
      targetUserId,
      message: alert.message 
    });
  }

  // Send low stock alerts
  emitLowStockAlert(productData: { productId: string; productName: string; currentStock: number; minStock: number }, targetUserId?: string) {
    this.emitSystemAlert({
      type: 'warning',
      message: `Low stock alert: ${productData.productName} (${productData.currentStock} remaining)`,
      data: productData,
    }, targetUserId);
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get connected users by role
  getConnectedUsersByRole(role: string): SocketUser[] {
    return Array.from(this.connectedUsers.values()).filter(user => user.userRole === role);
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  // Get user connection info
  getUserConnections(userId: string): SocketUser[] {
    const socketIds = this.userSockets.get(userId) || [];
    return socketIds.map(id => this.connectedUsers.get(id)).filter(Boolean) as SocketUser[];
  }

  // Broadcast maintenance notifications
  emitMaintenanceNotification(message: string, scheduledTime?: Date) {
    if (!this.io) return;

    this.io.emit('maintenance-notification', {
      message,
      scheduledTime,
      timestamp: new Date(),
    });

    logger.info('Maintenance notification broadcasted', { message });
  }
}

// Export singleton instance
export const socketService = new SocketService(); 