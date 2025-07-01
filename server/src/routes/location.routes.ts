import { Router } from 'express';
import { locationController } from '../controllers/location.controller';
import { protect } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(protect);

// Location CRUD routes
router.post('/', locationController.createLocation);
router.get('/', locationController.getLocations);
router.get('/:id', locationController.getLocationById);
router.put('/:id', locationController.updateLocation);
router.delete('/:id', locationController.deleteLocation);

// Location stock routes
router.get('/:id/stock', locationController.getLocationStock);

export default router; 