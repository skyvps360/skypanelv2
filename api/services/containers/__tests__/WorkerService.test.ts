/**
 * Worker Service Tests
 * Basic tests for worker registration and management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkerService } from '../WorkerService.js';

// Mock database
vi.mock('../../../lib/database.js', () => ({
  query: vi.fn(),
  transaction: vi.fn((callback) => callback({
    query: vi.fn().mockResolvedValue({ rows: [] })
  }))
}));

// Mock config
vi.mock('../../../config/index.js', () => ({
  config: {
    JWT_SECRET: 'test-secret'
  }
}));

describe('WorkerService', () => {
  describe('validateWorkerInfo', () => {
    it('should validate valid worker info', () => {
      const validInfo = {
        hostname: 'worker-1',
        ipAddress: '192.168.1.100',
        capacity: {
          cpuCores: 4,
          memoryMb: 8192,
          diskGb: 100
        }
      };

      // Access private method through any cast for testing
      expect(() => {
        (WorkerService as any).validateWorkerInfo(validInfo);
      }).not.toThrow();
    });

    it('should reject invalid hostname', () => {
      const invalidInfo = {
        hostname: '',
        ipAddress: '192.168.1.100',
        capacity: {
          cpuCores: 4,
          memoryMb: 8192,
          diskGb: 100
        }
      };

      expect(() => {
        (WorkerService as any).validateWorkerInfo(invalidInfo);
      }).toThrow('Hostname is required');
    });

    it('should reject invalid IP address', () => {
      const invalidInfo = {
        hostname: 'worker-1',
        ipAddress: '999.999.999.999',
        capacity: {
          cpuCores: 4,
          memoryMb: 8192,
          diskGb: 100
        }
      };

      expect(() => {
        (WorkerService as any).validateWorkerInfo(invalidInfo);
      }).toThrow('Valid IP address is required');
    });

    it('should reject invalid CPU cores', () => {
      const invalidInfo = {
        hostname: 'worker-1',
        ipAddress: '192.168.1.100',
        capacity: {
          cpuCores: 0,
          memoryMb: 8192,
          diskGb: 100
        }
      };

      expect(() => {
        (WorkerService as any).validateWorkerInfo(invalidInfo);
      }).toThrow('CPU cores must be between 1 and 256');
    });
  });

  describe('validateMetrics', () => {
    it('should validate valid metrics', () => {
      const validMetrics = {
        cpuPercent: 50,
        memoryPercent: 60,
        diskPercent: 70,
        containerCount: 5
      };

      expect(() => {
        (WorkerService as any).validateMetrics(validMetrics);
      }).not.toThrow();
    });

    it('should reject invalid CPU percent', () => {
      const invalidMetrics = {
        cpuPercent: 150,
        memoryPercent: 60,
        diskPercent: 70,
        containerCount: 5
      };

      expect(() => {
        (WorkerService as any).validateMetrics(invalidMetrics);
      }).toThrow('CPU percent must be between 0 and 100');
    });

    it('should reject negative container count', () => {
      const invalidMetrics = {
        cpuPercent: 50,
        memoryPercent: 60,
        diskPercent: 70,
        containerCount: -1
      };

      expect(() => {
        (WorkerService as any).validateMetrics(invalidMetrics);
      }).toThrow('Container count must be a non-negative number');
    });
  });

  describe('isValidIpAddress', () => {
    it('should validate IPv4 addresses', () => {
      expect((WorkerService as any).isValidIpAddress('192.168.1.1')).toBe(true);
      expect((WorkerService as any).isValidIpAddress('10.0.0.1')).toBe(true);
      expect((WorkerService as any).isValidIpAddress('172.16.0.1')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect((WorkerService as any).isValidIpAddress('999.999.999.999')).toBe(false);
      expect((WorkerService as any).isValidIpAddress('192.168.1')).toBe(false);
      expect((WorkerService as any).isValidIpAddress('not-an-ip')).toBe(false);
    });
  });
});
