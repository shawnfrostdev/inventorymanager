import { Request, Response } from 'express';
import { reportingService } from '../services/reporting.service';
import { analyticsService } from '../services/analytics.service';
import { logger } from '../utils/logger';
import { socketService } from '../services/socket.service';

export class ReportsController {
  // Get all report templates
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = reportingService.getTemplates();
      
      res.json({
        success: true,
        data: templates,
        message: 'Report templates retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get report templates', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve report templates',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get specific template
  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const template = reportingService.getTemplate(templateId);
      
      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Report template not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: template,
        message: 'Report template retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get report template', {
        templateId: req.params.templateId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve report template',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Create new report template
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const templateData = req.body;
      const template = await reportingService.createTemplate(templateData, userId);
      
      res.status(201).json({
        success: true,
        data: template,
        message: 'Report template created successfully'
      });
    } catch (error) {
      logger.error('Failed to create report template', {
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to create report template',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Generate report from template
  async generateReport(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const parameters = req.body.parameters || {};
      const userId = (req as any).user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const report = await reportingService.generateReport(templateId, parameters, userId);
      
      res.json({
        success: true,
        data: report,
        message: 'Report generated successfully'
      });
    } catch (error) {
      logger.error('Failed to generate report', {
        templateId: req.params.templateId,
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to generate report',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get recent reports
  async getRecentReports(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const reports = reportingService.getRecentReports(limit);
      
      res.json({
        success: true,
        data: reports,
        message: 'Recent reports retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get recent reports', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve recent reports',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get specific report
  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const report = await reportingService.getReport(reportId);
      
      if (!report) {
        res.status(404).json({
          success: false,
          message: 'Report not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: report,
        message: 'Report retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get report', {
        reportId: req.params.reportId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve report',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Export report
  async exportReport(req: Request, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const { format = 'csv', includeCharts = false, includeSummary = true } = req.body;
      
      const exportOptions = {
        format: format as 'pdf' | 'excel' | 'csv' | 'json',
        includeCharts,
        includeSummary
      };

      const result = await reportingService.exportReport(reportId, exportOptions);
      
      res.json({
        success: true,
        data: {
          fileName: result.fileName,
          downloadUrl: `/api/reports/download/${encodeURIComponent(result.fileName)}`
        },
        message: 'Report exported successfully'
      });
    } catch (error) {
      logger.error('Failed to export report', {
        reportId: req.params.reportId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to export report',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Download exported report
  async downloadReport(req: Request, res: Response): Promise<void> {
    try {
      const { fileName } = req.params;
      const filePath = `exports/${fileName}`;
      
      res.download(filePath, fileName, (err) => {
        if (err) {
          logger.error('Failed to download report', {
            fileName,
            error: err.message
          });
          
          if (!res.headersSent) {
            res.status(404).json({
              success: false,
              message: 'File not found'
            });
          }
        }
      });
    } catch (error) {
      logger.error('Failed to download report', {
        fileName: req.params.fileName,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to download report',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Delete template
  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const deleted = reportingService.deleteTemplate(templateId);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Report template not found'
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Report template deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete report template', {
        templateId: req.params.templateId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to delete report template',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get reporting statistics
  async getReportingStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = reportingService.getReportingStats();
      
      res.json({
        success: true,
        data: stats,
        message: 'Reporting statistics retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get reporting statistics', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve reporting statistics',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Quick report generation (predefined reports)
  async quickReport(req: Request, res: Response): Promise<void> {
    try {
      const { type, period = 'month' } = req.params;
      const userId = (req as any).user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      let templateId: string;
      let parameters: any = {};

      // Map quick report types to template IDs
      switch (type) {
        case 'sales-summary':
          templateId = 'sales_summary';
          parameters = {
            dateRange: this.getPeriodDateRange(period)
          };
          break;
        case 'inventory-levels':
          templateId = 'inventory_levels';
          break;
        case 'customer-analysis':
          templateId = 'customer_analysis';
          break;
        case 'financial-performance':
          templateId = 'financial_performance';
          parameters = { period };
          break;
        default:
          res.status(400).json({
            success: false,
            message: 'Invalid quick report type'
          });
          return;
      }

      const report = await reportingService.generateReport(templateId, parameters, userId);
      
      res.json({
        success: true,
        data: report,
        message: 'Quick report generated successfully'
      });
    } catch (error) {
      logger.error('Failed to generate quick report', {
        type: req.params.type,
        period: req.params.period,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to generate quick report',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get analytics data for reports dashboard
  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { type = 'sales', period = 'month' } = req.query;

      let analytics;
      switch (type) {
        case 'sales':
          analytics = await analyticsService.getSalesAnalytics(period as any);
          break;
        case 'inventory':
          analytics = await analyticsService.getInventoryAnalytics();
          break;
        case 'customer':
          analytics = await analyticsService.getCustomerAnalytics();
          break;
        case 'dashboard':
          analytics = await analyticsService.getDashboardData();
          break;
        default:
          res.status(400).json({
            success: false,
            message: 'Invalid analytics type'
          });
          return;
      }

      res.json({
        success: true,
        data: analytics,
        message: 'Analytics data retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get analytics data', {
        type: req.query.type,
        period: req.query.period,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics data',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get KPI data
  async getKPIs(req: Request, res: Response): Promise<void> {
    try {
      const kpis = analyticsService.getAllKPIs();
      
      res.json({
        success: true,
        data: kpis,
        message: 'KPIs retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get KPIs', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve KPIs',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get trend analysis
  async getTrends(req: Request, res: Response): Promise<void> {
    try {
      const trends = await analyticsService.getTrendAnalysis();
      
      res.json({
        success: true,
        data: trends,
        message: 'Trend analysis retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get trend analysis', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve trend analysis',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Get sales forecast
  async getForecast(req: Request, res: Response): Promise<void> {
    try {
      const periods = parseInt(req.query.periods as string) || 12;
      const forecast = await analyticsService.getSalesForecast(periods);
      
      res.json({
        success: true,
        data: forecast,
        message: 'Sales forecast retrieved successfully'
      });
    } catch (error) {
      logger.error('Failed to get sales forecast', {
        periods: req.query.periods,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sales forecast',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Utility method to get date range for period
  private getPeriodDateRange(period: string): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now);
    
    switch (period) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setMonth(now.getMonth() - 1);
    }
    
    return { start, end: now };
  }
}

export const reportsController = new ReportsController(); 