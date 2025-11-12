/**
 * Template Service Tests
 * Tests for application template CRUD operations and deployment
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateService } from '../TemplateService.js';

// Mock database module
vi.mock('../../../lib/database.js', () => ({
  query: vi.fn(),
  transaction: vi.fn()
}));

describe('TemplateService', () => {
  describe('validateNixExpression', () => {
    it('should reject empty Nix expression', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateNixExpression']('');
      }).toThrow('Nix expression cannot be empty');
    });

    it('should reject unbalanced braces', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateNixExpression']('{ let x = 1; in x');
      }).toThrow('unbalanced braces');
    });

    it('should reject unbalanced parentheses', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateNixExpression']('(let x = 1; in x');
      }).toThrow('unbalanced parentheses');
    });

    it('should reject unbalanced brackets', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateNixExpression']('[1 2 3');
      }).toThrow('unbalanced brackets');
    });

    it('should accept valid Nix expression', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateNixExpression']('{ pkgs }: let x = 1; in x');
      }).not.toThrow();
    });
  });

  describe('validateResourceLimits', () => {
    it('should reject CPU cores below minimum', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateResourceLimits']({
          cpuCores: 0.25,
          memoryMb: 512,
          diskGb: 10
        });
      }).toThrow('CPU cores must be between 0.5 and 16');
    });

    it('should reject CPU cores above maximum', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateResourceLimits']({
          cpuCores: 20,
          memoryMb: 512,
          diskGb: 10
        });
      }).toThrow('CPU cores must be between 0.5 and 16');
    });

    it('should reject memory below minimum', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateResourceLimits']({
          cpuCores: 1,
          memoryMb: 128,
          diskGb: 10
        });
      }).toThrow('Memory must be between 256 MB and 32 GB');
    });

    it('should reject memory above maximum', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateResourceLimits']({
          cpuCores: 1,
          memoryMb: 40000,
          diskGb: 10
        });
      }).toThrow('Memory must be between 256 MB and 32 GB');
    });

    it('should reject disk below minimum', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateResourceLimits']({
          cpuCores: 1,
          memoryMb: 512,
          diskGb: 0.5
        });
      }).toThrow('Disk must be between 1 GB and 500 GB');
    });

    it('should reject disk above maximum', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateResourceLimits']({
          cpuCores: 1,
          memoryMb: 512,
          diskGb: 600
        });
      }).toThrow('Disk must be between 1 GB and 500 GB');
    });

    it('should accept valid resource limits', () => {
      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['validateResourceLimits']({
          cpuCores: 2,
          memoryMb: 2048,
          diskGb: 20
        });
      }).not.toThrow();
    });
  });

  describe('calculateDeploymentOrder', () => {
    it('should handle services with no dependencies', () => {
      const services = [
        { name: 'service1', dependencies: [] },
        { name: 'service2', dependencies: [] }
      ];

      // @ts-ignore - accessing private method for testing
      const order = TemplateService['calculateDeploymentOrder'](services);

      expect(order).toHaveLength(2);
      expect(order).toContain('service1');
      expect(order).toContain('service2');
    });

    it('should order services by dependencies', () => {
      const services = [
        { name: 'app', dependencies: ['database'] },
        { name: 'database', dependencies: [] }
      ];

      // @ts-ignore - accessing private method for testing
      const order = TemplateService['calculateDeploymentOrder'](services);

      expect(order).toEqual(['database', 'app']);
    });

    it('should handle complex dependency chains', () => {
      const services = [
        { name: 'frontend', dependencies: ['api'] },
        { name: 'api', dependencies: ['database', 'cache'] },
        { name: 'database', dependencies: [] },
        { name: 'cache', dependencies: [] }
      ];

      // @ts-ignore - accessing private method for testing
      const order = TemplateService['calculateDeploymentOrder'](services);

      // Database and cache should come before api
      const dbIndex = order.indexOf('database');
      const cacheIndex = order.indexOf('cache');
      const apiIndex = order.indexOf('api');
      const frontendIndex = order.indexOf('frontend');

      expect(dbIndex).toBeLessThan(apiIndex);
      expect(cacheIndex).toBeLessThan(apiIndex);
      expect(apiIndex).toBeLessThan(frontendIndex);
    });

    it('should detect circular dependencies', () => {
      const services = [
        { name: 'service1', dependencies: ['service2'] },
        { name: 'service2', dependencies: ['service1'] }
      ];

      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['calculateDeploymentOrder'](services);
      }).toThrow('Circular dependency detected');
    });
  });

  describe('getDefaultPort', () => {
    it('should return correct port for PostgreSQL', () => {
      // @ts-ignore - accessing private method for testing
      expect(TemplateService['getDefaultPort']('postgres')).toBe(5432);
      // @ts-ignore - accessing private method for testing
      expect(TemplateService['getDefaultPort']('postgresql')).toBe(5432);
    });

    it('should return correct port for MySQL', () => {
      // @ts-ignore - accessing private method for testing
      expect(TemplateService['getDefaultPort']('mysql')).toBe(3306);
      // @ts-ignore - accessing private method for testing
      expect(TemplateService['getDefaultPort']('mariadb')).toBe(3306);
    });

    it('should return correct port for MongoDB', () => {
      // @ts-ignore - accessing private method for testing
      expect(TemplateService['getDefaultPort']('mongo')).toBe(27017);
      // @ts-ignore - accessing private method for testing
      expect(TemplateService['getDefaultPort']('mongodb')).toBe(27017);
    });

    it('should return correct port for Redis', () => {
      // @ts-ignore - accessing private method for testing
      expect(TemplateService['getDefaultPort']('redis')).toBe(6379);
    });

    it('should return correct port for web services', () => {
      // @ts-ignore - accessing private method for testing
      expect(TemplateService['getDefaultPort']('web')).toBe(3000);
      // @ts-ignore - accessing private method for testing
      expect(TemplateService['getDefaultPort']('app')).toBe(3000);
    });

    it('should return correct port for API services', () => {
      // @ts-ignore - accessing private method for testing
      expect(TemplateService['getDefaultPort']('api')).toBe(8080);
    });

    it('should return default port for unknown services', () => {
      // @ts-ignore - accessing private method for testing
      expect(TemplateService['getDefaultPort']('unknown')).toBe(8080);
    });
  });

  describe('detectCircularDependencies', () => {
    it('should not throw for valid dependencies', () => {
      const services = [
        { name: 'app', dependencies: ['database'] },
        { name: 'database', dependencies: [] }
      ];

      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['detectCircularDependencies'](services);
      }).not.toThrow();
    });

    it('should detect direct circular dependency', () => {
      const services = [
        { name: 'service1', dependencies: ['service2'] },
        { name: 'service2', dependencies: ['service1'] }
      ];

      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['detectCircularDependencies'](services);
      }).toThrow('Circular dependency detected');
    });

    it('should detect indirect circular dependency', () => {
      const services = [
        { name: 'service1', dependencies: ['service2'] },
        { name: 'service2', dependencies: ['service3'] },
        { name: 'service3', dependencies: ['service1'] }
      ];

      expect(() => {
        // @ts-ignore - accessing private method for testing
        TemplateService['detectCircularDependencies'](services);
      }).toThrow('Circular dependency detected');
    });
  });
});
