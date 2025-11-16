/**
 * White-label message utilities
 * Provides generic messaging that hides provider-specific details from end users
 * while maintaining the white-label reseller model
 */

export interface ProviderResult {
  provider: 'linode';
  success: boolean;
  error?: string;
  providerId?: string | number;
}

export interface SSHKeyMessage {
  message: string;
  description: string;
  isPartial: boolean;
}

/**
 * Generate white-label success message for SSH key creation
 * @param keyName - Name of the SSH key
 * @param results - Array of provider operation results
 * @returns Message object with title, description, and partial success flag
 */
export function getSSHKeySuccessMessage(keyName: string, results: ProviderResult[]): SSHKeyMessage {
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  if (successCount === totalCount && totalCount > 0) {
    return {
      message: `SSH key '${keyName}' added successfully`,
      description: 'The key has been synchronized to all cloud providers.',
      isPartial: false
    };
  } else if (successCount > 0) {
    return {
      message: `SSH key '${keyName}' added with warnings`,
      description: 'The key was added to your account but some cloud providers could not be synchronized.',
      isPartial: true
    };
  } else if (totalCount > 0) {
    return {
      message: `SSH key '${keyName}' saved locally`,
      description: 'The key was saved but could not be synchronized to cloud providers. You may need to add it manually.',
      isPartial: true
    };
  } else {
    // No providers configured
    return {
      message: `SSH key '${keyName}' saved`,
      description: 'The key has been saved to your account.',
      isPartial: false
    };
  }
}

/**
 * Generate white-label success message for SSH key deletion
 * @param keyName - Name of the SSH key
 * @param results - Array of provider operation results
 * @returns Message object with title, description, and partial success flag
 */
export function getSSHKeyDeleteMessage(keyName: string, results: ProviderResult[]): SSHKeyMessage {
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  if (successCount === totalCount && totalCount > 0) {
    return {
      message: `SSH key '${keyName}' removed successfully`,
      description: 'The key has been removed from all cloud providers.',
      isPartial: false
    };
  } else if (successCount > 0) {
    return {
      message: `SSH key '${keyName}' removed with warnings`,
      description: 'The key was removed from your account but some cloud providers could not be synchronized.',
      isPartial: true
    };
  } else if (totalCount > 0) {
    return {
      message: `SSH key '${keyName}' removed locally`,
      description: 'The key was removed from your account but could not be synchronized to cloud providers.',
      isPartial: true
    };
  } else {
    // No providers configured
    return {
      message: `SSH key '${keyName}' removed`,
      description: 'The key has been removed from your account.',
      isPartial: false
    };
  }
}

/**
 * Generate white-label activity log message for SSH key operations
 * @param operation - Type of operation (create or delete)
 * @param keyName - Name of the SSH key
 * @returns Activity log message string
 */
export function getActivityLogMessage(operation: 'create' | 'delete', keyName: string): string {
  return operation === 'create' 
    ? `Added SSH key '${keyName}'`
    : `Removed SSH key '${keyName}'`;
}

/**
 * Build white-label metadata structure for activity logs
 * Stores provider-specific details for admin debugging without exposing them to users
 * @param fingerprint - SSH key fingerprint
 * @param results - Array of provider operation results
 * @returns Metadata object with sync status and provider details
 */
export function buildActivityMetadata(fingerprint: string, results: ProviderResult[]): Record<string, any> {
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  
  const providerDetails: Record<string, any> = {};
  results.forEach((result, index) => {
    providerDetails[`provider_${index + 1}`] = {
      type: result.provider,
      status: result.success ? 'success' : 'failed',
      ...(result.providerId && { id: result.providerId }),
      ...(result.error && { error: result.error })
    };
  });
  
  return {
    fingerprint,
    syncStatus: {
      total: results.length,
      successful: successCount,
      failed: failedCount
    },
    providerDetails
  };
}
