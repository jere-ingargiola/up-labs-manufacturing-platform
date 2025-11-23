import { Equipment, SensorData, ApiResponse, APIGatewayProxyEvent, APIGatewayProxyResult } from '../../models';
import { getEquipmentById, getRecentSensorReadings } from '../../services/databaseService';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const equipmentId = event.pathParameters?.id;
    
    if (!equipmentId) {
      return createErrorResponse(400, 'Equipment ID is required');
    }

    console.log(`Fetching status for equipment: ${equipmentId}`);

    // Get equipment details and recent sensor readings in parallel
    const [equipment, recentReadings] = await Promise.all([
      getEquipmentById(equipmentId),
      getRecentSensorReadings(equipmentId, 10)
    ]);
    
    if (!equipment) {
      return createErrorResponse(404, 'Equipment not found');
    }

    // Calculate status summary
    const currentReading = recentReadings[0] || null;
    const lastReadingAge = currentReading ? 
      Math.floor((Date.now() - new Date(currentReading.timestamp).getTime()) / 60000) : null;

    const response = {
      equipment,
      current_readings: currentReading,
      recent_readings: recentReadings,
      status_summary: {
        is_online: equipment.status === 'online',
        last_reading_age_minutes: lastReadingAge,
        readings_in_last_hour: recentReadings.filter(r => 
          Date.now() - new Date(r.timestamp).getTime() < 3600000
        ).length,
        current_temperature: currentReading?.temperature,
        current_vibration: currentReading?.vibration,
        current_pressure: currentReading?.pressure,
        health_status: determineHealthStatus(equipment, currentReading, lastReadingAge)
      }
    };

    return createSuccessResponse(response);

  } catch (error) {
    console.error('Error fetching equipment status:', error);
    return createErrorResponse(500, 'Internal server error');
  }
};

function determineHealthStatus(
  equipment: Equipment, 
  currentReading: SensorData | null, 
  lastReadingAge: number | null
): 'healthy' | 'warning' | 'critical' | 'offline' {
  
  // Equipment is offline
  if (equipment.status === 'offline' || equipment.status === 'error') {
    return 'offline';
  }

  // No recent data
  if (!currentReading || !lastReadingAge || lastReadingAge > 60) {
    return 'offline';
  }

  // Check if readings are in warning ranges
  const hasWarnings = 
    (currentReading.temperature !== undefined && currentReading.temperature > 150) ||
    (currentReading.vibration !== undefined && currentReading.vibration > 2.0) ||
    (currentReading.pressure !== undefined && (currentReading.pressure > 500 || currentReading.pressure < 50));

  // Check if readings are in critical ranges  
  const hasCritical = 
    (currentReading.temperature !== undefined && currentReading.temperature > 180) ||
    (currentReading.vibration !== undefined && currentReading.vibration > 5.0) ||
    (currentReading.pressure !== undefined && currentReading.pressure > 800);

  if (hasCritical) return 'critical';
  if (hasWarnings) return 'warning';
  
  return 'healthy';
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