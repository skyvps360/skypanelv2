/**
 * Provider Service Interface
 * 
 * Defines the contract that all provider implementations must follow.
 * This interface ensures consistency across different cloud providers
 * and enables the system to work with multiple providers through a
 * unified API.
 * 
 * @module IProviderService
 */

/**
 * Supported cloud provider types
 * 
 * @typedef {('linode')} ProviderType
 */
export type ProviderType = 'linode';

/**
 * Common normalized instance representation
 * 
 * All provider-specific instance formats are normalized to this structure
 * to provide a consistent interface across providers.
 * 
 * @interface ProviderInstance
 * @property {string} id - Unique identifier for the instance
 * @property {string} label - Human-readable name for the instance
 * @property {('running'|'stopped'|'provisioning'|'rebooting'|'error'|'unknown')} status - Current instance status
 * @property {string[]} ipv4 - Array of IPv4 addresses assigned to the instance
 * @property {string} [ipv6] - IPv6 address if enabled
 * @property {string} region - Region/datacenter where instance is located
 * @property {Object} specs - Instance specifications
 * @property {number} specs.vcpus - Number of virtual CPUs
 * @property {number} specs.memory - RAM in megabytes
 * @property {number} specs.disk - Disk space in gigabytes
 * @property {number} specs.transfer - Monthly transfer quota in gigabytes
 * @property {string} created - ISO 8601 timestamp of instance creation
 * @property {string} [image] - Operating system image identifier
 * @property {string[]} [tags] - Optional tags for organization
 */
export interface ProviderInstance {
  id: string;
  label: string;
  status: 'running' | 'stopped' | 'provisioning' | 'rebooting' | 'error' | 'unknown';
  ipv4: string[];
  ipv6?: string;
  region: string;
  specs: {
    vcpus: number;
    memory: number; // MB
    disk: number; // GB
    transfer: number; // GB
  };
  created: string;
  image?: string;
  tags?: string[];
}

/**
 * Common normalized plan representation
 * 
 * Represents a VPS plan/size with standardized pricing and specifications.
 * 
 * @interface ProviderPlan
 * @property {string} id - Unique identifier for the plan
 * @property {string} label - Human-readable plan name
 * @property {number} vcpus - Number of virtual CPUs
 * @property {number} memory - RAM in megabytes
 * @property {number} disk - Disk space in gigabytes
 * @property {number} transfer - Monthly transfer quota in gigabytes
 * @property {Object} price - Pricing information
 * @property {number} price.hourly - Hourly rate in USD
 * @property {number} price.monthly - Monthly rate in USD
 * @property {string[]} regions - Array of region IDs where plan is available
 * @property {string} [type_class] - Optional plan class/category
 */
export interface ProviderPlan {
  id: string;
  label: string;
  vcpus: number;
  memory: number; // MB
  disk: number; // GB
  transfer: number; // GB
  price: {
    hourly: number;
    monthly: number;
  };
  regions: string[];
  type_class?: string;
}

/**
 * Common normalized image representation
 * 
 * Represents an operating system or application image.
 * 
 * @interface ProviderImage
 * @property {string} id - Unique identifier for the image
 * @property {string} [slug] - URL-friendly identifier
 * @property {string} label - Human-readable image name
 * @property {string} [description] - Detailed description of the image
 * @property {string} [distribution] - OS distribution (Ubuntu, Debian, etc.)
 * @property {string} [version] - OS version number
 * @property {number} [minDiskSize] - Minimum disk size required in GB
 * @property {boolean} public - Whether image is publicly available
 */
export interface ProviderImage {
  id: string;
  slug?: string;
  label: string;
  description?: string;
  distribution?: string;
  version?: string;
  minDiskSize?: number;
  public: boolean;
}

/**
 * Common normalized region representation
 * 
 * Represents a datacenter region where instances can be deployed.
 * 
 * @interface ProviderRegion
 * @property {string} id - Unique identifier for the region
 * @property {string} label - Human-readable region name
 * @property {string} [country] - Country code or name
 * @property {boolean} available - Whether region is currently available
 * @property {string[]} [capabilities] - Array of supported features
 */
export interface ProviderRegion {
  id: string;
  label: string;
  country?: string;
  available: boolean;
  capabilities?: string[];
}

/**
 * Parameters for creating an instance
 * 
 * Contains all configuration options for creating a new VPS instance.
 * Provider-specific options are included as optional fields.
 * 
 * @interface CreateInstanceParams
 * @property {string} label - Human-readable name for the instance
 * @property {string} type - Plan/size identifier
 * @property {string} region - Region identifier where instance will be created
 * @property {string} image - Operating system image identifier
 * @property {string} rootPassword - Root user password
 * @property {string[]} [sshKeys] - Array of SSH key identifiers or public keys
 * @property {boolean} [backups] - Enable automated backups
 * @property {boolean} [privateIP] - Enable private IP address (Linode)
 * @property {string[]} [tags] - Tags for organization
 * @property {number} [stackscriptId] - Linode StackScript ID
 * @property {Record<string, any>} [stackscriptData] - StackScript user-defined fields
 * @property {string} [appSlug] - Marketplace application slug
 * @property {Record<string, any>} [appData] - Marketplace app configuration
 */
export interface CreateInstanceParams {
  label: string;
  type: string; // Plan ID
  region: string;
  image: string;
  rootPassword: string;
  sshKeys?: string[];
  backups?: boolean;
  privateIP?: boolean;
  tags?: string[];
  // Provider-specific options
  stackscriptId?: number;
  stackscriptData?: Record<string, any>;
  appSlug?: string;
  appData?: Record<string, any>;
}

/**
 * Standardized error structure
 * 
 * All provider-specific errors are normalized to this format for
 * consistent error handling across the application.
 * 
 * @interface ProviderError
 * @property {string} code - Standardized error code (e.g., 'INVALID_CREDENTIALS')
 * @property {string} message - Human-readable error message
 * @property {string} [field] - Field name that caused the error (for validation errors)
 * @property {ProviderType} provider - Provider that generated the error
 * @property {any} [originalError] - Original error object for debugging
 */
export interface ProviderError {
  code: string;
  message: string;
  field?: string;
  provider: ProviderType;
  originalError?: any;
}

/**
 * Interface that all provider implementations must implement
 * 
 * This interface defines the contract for all cloud provider integrations.
 * Each provider must implement these methods to work with the system.
 * 
 * @interface IProviderService
 */
export interface IProviderService {
  /**
   * Get the provider type
   * 
   * @returns {ProviderType} The provider type identifier
   * @example
   * const type = provider.getProviderType(); // 'linode'
   */
  getProviderType(): ProviderType;

  /**
   * Create a new VPS instance
   * 
   * Creates a new virtual private server with the specified configuration.
   * The instance will be provisioned asynchronously by the provider.
   * 
   * @param {CreateInstanceParams} params - Instance configuration parameters
   * @returns {Promise<ProviderInstance>} Normalized instance details
   * @throws {ProviderError} If creation fails or validation errors occur
   * @example
   * const instance = await provider.createInstance({
   *   label: 'web-server',
   *   type: 's-1vcpu-1gb',
   *   region: 'nyc3',
   *   image: 'ubuntu-22-04-x64',
   *   rootPassword: 'SecurePassword123!'
   * });
   */
  createInstance(params: CreateInstanceParams): Promise<ProviderInstance>;

  /**
   * Get details of a specific instance
   * 
   * Fetches current status and configuration of an existing instance.
   * 
   * @param {string} instanceId - Provider-specific instance identifier
   * @returns {Promise<ProviderInstance>} Normalized instance details
   * @throws {ProviderError} If instance not found or API error occurs
   * @example
   * const instance = await provider.getInstance('12345');
   */
  getInstance(instanceId: string): Promise<ProviderInstance>;

  /**
   * List all instances for this provider
   * 
   * Retrieves all VPS instances associated with the provider account.
   * 
   * @returns {Promise<ProviderInstance[]>} Array of normalized instances
   * @throws {ProviderError} If API error occurs
   * @example
   * const instances = await provider.listInstances();
   * console.log(`Found ${instances.length} instances`);
   */
  listInstances(): Promise<ProviderInstance[]>;

  /**
   * Perform an action on an instance
   * 
   * Executes a power or lifecycle action on the specified instance.
   * 
   * @param {string} instanceId - Provider-specific instance identifier
   * @param {string} action - Action to perform (boot, shutdown, reboot, delete, etc.)
   * @param {Record<string, any>} [params] - Optional action-specific parameters
   * @returns {Promise<void>}
   * @throws {ProviderError} If action fails or is not supported
   * @example
   * await provider.performAction('12345', 'reboot');
   * await provider.performAction('12345', 'delete');
   */
  performAction(instanceId: string, action: string, params?: Record<string, any>): Promise<void>;

  /**
   * Get available plans/sizes for this provider
   * 
   * Retrieves all available VPS plans with pricing and specifications.
   * Results are typically cached to reduce API calls.
   * 
   * @returns {Promise<ProviderPlan[]>} Array of normalized plans
   * @throws {ProviderError} If API error occurs
   * @example
   * const plans = await provider.getPlans();
   * const cheapest = plans.sort((a, b) => a.price.monthly - b.price.monthly)[0];
   */
  getPlans(): Promise<ProviderPlan[]>;

  /**
   * Get available images for this provider
   * 
   * Retrieves all available operating system and application images.
   * Results are typically cached to reduce API calls.
   * 
   * @returns {Promise<ProviderImage[]>} Array of normalized images
   * @throws {ProviderError} If API error occurs
   * @example
   * const images = await provider.getImages();
   * const ubuntu = images.filter(img => img.distribution === 'Ubuntu');
   */
  getImages(): Promise<ProviderImage[]>;

  /**
   * Get available regions for this provider
   * 
   * Retrieves all datacenter regions where instances can be deployed.
   * Results are typically cached to reduce API calls.
   * 
   * @returns {Promise<ProviderRegion[]>} Array of normalized regions
   * @throws {ProviderError} If API error occurs
   * @example
   * const regions = await provider.getRegions();
   * const usRegions = regions.filter(r => r.id.startsWith('us-'));
   */
  getRegions(): Promise<ProviderRegion[]>;

  /**
   * Validate API credentials
   * 
   * Tests whether the configured API credentials are valid and have
   * sufficient permissions to perform operations.
   * 
   * @returns {Promise<boolean>} True if credentials are valid, false otherwise
   * @example
   * const isValid = await provider.validateCredentials();
   * if (!isValid) {
   *   console.error('Invalid API credentials');
   * }
   */
  validateCredentials(): Promise<boolean>;
}
