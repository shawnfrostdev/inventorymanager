import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { protect } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validateRequest';
import {
  createCustomerSchema,
  updateCustomerSchema,
  createOrderSchema,
  updateOrderSchema,
} from '../types/order.types';

const router = Router();

// Apply authentication to all routes
router.use(protect);

// Customer routes
router.post('/customers', validateRequest(createCustomerSchema), OrderController.createCustomer);
router.get('/customers', OrderController.getCustomers);
router.get('/customers/suggestions', OrderController.getCustomerSuggestions);
router.get('/customers/:id', OrderController.getCustomerById);
router.put('/customers/:id', validateRequest(updateCustomerSchema), OrderController.updateCustomer);
router.delete('/customers/:id', OrderController.deleteCustomer);

// Order routes
router.post('/orders', validateRequest(createOrderSchema), OrderController.createOrder);
router.get('/orders', OrderController.getOrders);
router.get('/orders/stats', OrderController.getOrderStats);
router.get('/orders/suggestions', OrderController.getOrderSuggestions);
router.get('/orders/:id', OrderController.getOrderById);
router.put('/orders/:id', validateRequest(updateOrderSchema), OrderController.updateOrder);
router.delete('/orders/:id', OrderController.deleteOrder);

// Bulk operations
router.put('/orders/bulk/status', OrderController.bulkUpdateOrderStatus);

export default router; 