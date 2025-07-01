import { Router } from 'express';
import { transferController } from '../controllers/transfer.controller';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(protect);

// Transfer routes
router.post('/', transferController.transferStock);
router.get('/', transferController.getTransferHistory);
router.get('/:id', transferController.getTransferById);

// Stock level check route
router.get('/stock/:productId/:locationId', transferController.getLocationStockLevel);

export default router; 