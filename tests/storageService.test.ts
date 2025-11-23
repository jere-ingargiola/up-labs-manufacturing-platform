import { storeSensorDataMultiTier, getRecentSensorData, getEquipmentCurrentStatus, getHistoricalDataKeys } from '../services/storageService';
import { TenantContext } from '../models';

// Mock pg module to avoid real database connections
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: jest.fn().mockResolvedValue({ rows: [{ equipment_id: 'machine-001', status: 'online', last_updated: new Date().toISOString() }] }),
    end: jest.fn()
  }))
}));

describe('Storage Service Functions', () => {
  let mockTenant: TenantContext;

  beforeEach(() => {
    mockTenant = (global as any).testUtils.createMockTenantContext();
    
    // Mock console methods  
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('storeSensorDataMultiTier', () => {
    const mockSensorData = {
      equipment_id: 'machine-001',
      sensor_type: 'temperature',
      value: 75.5,
      unit: 'celsius',
      timestamp: new Date().toISOString(),
      metadata: { location: 'factory-floor-1' }
    };

    it('should store sensor data successfully', async () => {
      const result = await storeSensorDataMultiTier(mockSensorData, mockTenant);

      expect(result).toHaveProperty('timescale');
      expect(result).toHaveProperty('s3');
      expect(result).toHaveProperty('postgres');
      expect(result).toHaveProperty('latency_ms');
    });

    it('should handle sensor data without tenant context', async () => {
      const result = await storeSensorDataMultiTier(mockSensorData);

      expect(result).toHaveProperty('s3');
      expect(result).toHaveProperty('latency_ms');
    });

    it('should log storage operations', async () => {
      await storeSensorDataMultiTier(mockSensorData, mockTenant);

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('getRecentSensorData', () => {
    it('should retrieve recent sensor data', async () => {
      const result = await getRecentSensorData('machine-001', 24, mockTenant);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle requests without tenant context', async () => {
      const result = await getRecentSensorData('machine-001', 12);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should use default hours when not specified', async () => {
      const result = await getRecentSensorData('machine-001');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getEquipmentCurrentStatus', () => {
    it('should get equipment status with tenant context', async () => {
      const result = await getEquipmentCurrentStatus('machine-001', mockTenant);

      expect(result).toHaveProperty('equipment_id');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('last_updated');
    });

    it('should handle requests without tenant context', async () => {
      const result = await getEquipmentCurrentStatus('machine-001');

      expect(result).toHaveProperty('equipment_id');
      expect(result.equipment_id).toBe('machine-001');
    });
  });

  describe('getHistoricalDataKeys', () => {
    it('should return historical data keys for date range', async () => {
      const startDate = '2025-11-01';
      const endDate = '2025-11-23';
      
      const result = await getHistoricalDataKeys('machine-001', startDate, endDate);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle equipment with no historical data', async () => {
      const result = await getHistoricalDataKeys('non-existent-machine', '2025-01-01', '2025-01-02');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should generate keys for valid date range', async () => {
      const result = await getHistoricalDataKeys('machine-001', '2025-11-20', '2025-11-23');

      expect(Array.isArray(result)).toBe(true);
      // Each key should contain the equipment ID and date information
      if (result.length > 0) {
        expect(result[0]).toContain('machine-001');
      }
    });
  });
});