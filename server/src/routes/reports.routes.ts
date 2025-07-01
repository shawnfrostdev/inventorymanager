import express from 'express';
import { reportsController } from '../controllers/reports.controller';
import { protect } from '../middleware/authMiddleware';
import { rateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Apply authentication and rate limiting to all routes
router.use(protect);
router.use(rateLimiter.readEndpoints); // Default rate limiting

// Report Templates Routes
router.get('/templates', reportsController.getTemplates);
router.get('/templates/:templateId', reportsController.getTemplate);
router.post('/templates', rateLimiter.writeEndpoints, reportsController.createTemplate);
router.delete('/templates/:templateId', rateLimiter.writeEndpoints, reportsController.deleteTemplate);

// Report Generation Routes
router.post('/templates/:templateId/generate', rateLimiter.writeEndpoints, reportsController.generateReport);
router.get('/recent', reportsController.getRecentReports);
router.get('/:reportId', reportsController.getReport);

// Report Export Routes
router.post('/:reportId/export', rateLimiter.writeEndpoints, reportsController.exportReport);
router.get('/download/:fileName', reportsController.downloadReport);

// Quick Reports (predefined templates)
router.get('/quick/:type', reportsController.quickReport);
router.get('/quick/:type/:period', reportsController.quickReport);

// Analytics Routes
router.get('/analytics/dashboard', reportsController.getAnalytics);
router.get('/analytics/sales', reportsController.getAnalytics);
router.get('/analytics/inventory', reportsController.getAnalytics);
router.get('/analytics/customers', reportsController.getAnalytics);

// KPI Routes
router.get('/kpis/all', reportsController.getKPIs);
router.get('/trends/analysis', reportsController.getTrends);
router.get('/forecast/sales', reportsController.getForecast);

// Statistics and Meta Routes
router.get('/stats/overview', reportsController.getReportingStats);

export default router; 