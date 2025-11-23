import { 
  ProductionMetrics, ApiResponse, APIGatewayProxyEvent, APIGatewayProxyResult,
  TenantContext
} from '../../models';
import { getEquipmentMetrics } from '../../services/databaseService';
import { withTenantContext, TenantMetricsService } from '../../services/tenantService';
import { CostOptimizationService } from '../../services/costOptimizationService';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return withTenantContext(event, async (tenantContext, event) => {
    const startTime = Date.now();
    
    try {
      // Track tenant usage for cost optimization
      await TenantMetricsService.trackUsage(tenantContext, 'equipment-metrics-query');
      
      const equipmentId = event.pathParameters?.id;
      const queryParams = event.queryStringParameters || {};
    
    if (!equipmentId) {
      return createErrorResponse(400, 'Equipment ID is required');
    }

    // Default to last 30 days if no date range provided
    const endDate = queryParams.end_date || new Date().toISOString();
    const startDate = queryParams.start_date || 
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`Fetching metrics for tenant ${tenantContext.tenant_id}, equipment: ${equipmentId} from ${startDate} to ${endDate}`);

    // Cost-optimized database query with tenant context
    const metrics = await getEquipmentMetrics(equipmentId, startDate, endDate);

    // Calculate aggregate metrics
    const aggregateMetrics = calculateAggregateMetrics(metrics);

    const processingTime = Date.now() - startTime;
    
    const response = {
      equipment_id: equipmentId,
      tenant_id: tenantContext.tenant_id,
      date_range: {
        start: startDate,
        end: endDate
      },
      daily_metrics: metrics,
      aggregate_metrics: aggregateMetrics,
      total_days: metrics.length,
      processing_time_ms: processingTime,
      cost_optimized: true  // Indicate this uses cost-optimized multi-tenant storage
    };

    return createSuccessResponse(response);

    } catch (error) {
      console.error(`Error fetching equipment metrics for tenant ${tenantContext.tenant_id}:`, error);
      return createErrorResponse(500, 'Internal server error');
    }
  });
};

function calculateAggregateMetrics(dailyMetrics: ProductionMetrics[]) {
  if (dailyMetrics.length === 0) {
    return null;
  }

  const totals = dailyMetrics.reduce((acc, metric) => ({
    total_uptime: acc.total_uptime + metric.uptime_percentage,
    total_production: acc.total_production + metric.total_production,
    total_alerts: acc.total_alerts + metric.alert_count,
    total_maintenance: acc.total_maintenance + metric.maintenance_events,
    avg_temp_sum: acc.avg_temp_sum + metric.avg_temperature,
    max_temp: Math.max(acc.max_temp, metric.max_temperature),
    avg_vibration_sum: acc.avg_vibration_sum + metric.avg_vibration,
    max_vibration: Math.max(acc.max_vibration, metric.max_vibration),
    avg_pressure_sum: acc.avg_pressure_sum + metric.avg_pressure,
    max_pressure: Math.max(acc.max_pressure, metric.max_pressure)
  }), {
    total_uptime: 0,
    total_production: 0,
    total_alerts: 0,
    total_maintenance: 0,
    avg_temp_sum: 0,
    max_temp: 0,
    avg_vibration_sum: 0,
    max_vibration: 0,
    avg_pressure_sum: 0,
    max_pressure: 0
  });

  const dayCount = dailyMetrics.length;

  return {
    average_uptime_percentage: totals.total_uptime / dayCount,
    total_production: totals.total_production,
    total_alerts: totals.total_alerts,
    total_maintenance_events: totals.total_maintenance,
    average_temperature: totals.avg_temp_sum / dayCount,
    maximum_temperature: totals.max_temp,
    average_vibration: totals.avg_vibration_sum / dayCount,
    maximum_vibration: totals.max_vibration,
    average_pressure: totals.avg_pressure_sum / dayCount,
    maximum_pressure: totals.max_pressure,
    overall_efficiency: (totals.total_uptime / dayCount) * 0.8, // Simplified calculation
    days_analyzed: dayCount
  };
}

function createSuccessResponse(data: any): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    },
    body: JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString()
    } as ApiResponse<typeof data>)
  };
}

function createErrorResponse(statusCode: number, error: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type', 
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    },
    body: JSON.stringify({
      success: false,
      error,
      timestamp: new Date().toISOString()
    } as ApiResponse<null>)
  };
}