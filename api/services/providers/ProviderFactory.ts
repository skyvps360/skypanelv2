/**
 * Provider Factory
 * 
 * Factory class for creating provider service instances based on provider type.
 * This is the primary entry point for instantiating provider services.
 * 
 * @class ProviderFactory
 * 
 * @example
 * // Check if provider is supported
 * if (ProviderFactory.isProviderSupported('linode')) {
 *   const provider = ProviderFactory.createProvider('linode', apiToken, providerId);
 * }
 */

import { IProviderService, ProviderType } from './IProviderService.js';
import { LinodeProviderService } from './LinodeProviderService.js';

export class ProviderFactory {
  /**
   * Create a provider service instance
   * 
   * Instantiates the appropriate provider service based on the provider type.
   * The returned instance implements the IProviderService interface.
   * 
   * @static
   * @param {ProviderType} providerType - The type of provider (linode)
   * @param {string} apiToken - The API token for authenticating with the provider
   * @param {string} [providerId] - Optional provider ID for cache keying and identification
   * @returns {IProviderService} Provider service instance
   * @throws {Error} If provider type is not supported or not yet implemented
   * 
   * @example
   * // Create a Linode provider
   * const linode = ProviderFactory.createProvider('linode', 'my-api-token', 'provider-uuid');
   * 
   * // Use the provider
   * const instances = await linode.listInstances();
   */
  static createProvider(providerType: ProviderType, apiToken: string, providerId?: string): IProviderService {
    switch (providerType) {
      case 'linode':
        return new LinodeProviderService(apiToken, providerId);
      default:
        throw new Error(`Unknown provider type: ${providerType}`);
    }
  }

  /**
   * Get list of supported provider types
   * 
   * Returns an array of all currently supported provider types.
   * This list only includes providers that are fully implemented.
   * 
   * @static
   * @returns {ProviderType[]} Array of supported provider type identifiers
   * 
   * @example
   * const supported = ProviderFactory.getSupportedProviders();
   * console.log('Supported providers:', supported); // ['linode']
   */
  static getSupportedProviders(): ProviderType[] {
    return ['linode'];
  }

  /**
   * Check if a provider type is supported
   * 
   * Validates whether a given provider type string is currently supported
   * by the system. Useful for validation before attempting to create a provider.
   * 
   * @static
   * @param {string} providerType - Provider type string to check
   * @returns {boolean} True if provider is supported, false otherwise
   * 
   * @example
   * if (ProviderFactory.isProviderSupported('linode')) {
   *   const provider = ProviderFactory.createProvider('linode', token);
   * } else {
   *   console.error('Provider not supported');
   * }
   */
  static isProviderSupported(providerType: string): boolean {
    return this.getSupportedProviders().includes(providerType as ProviderType);
  }
}
