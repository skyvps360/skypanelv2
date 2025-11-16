import { query } from "./database.js";
import { encryptSecret, decryptSecret } from "./crypto.js";

export type ProviderType = "linode";

/**
 * Normalizes a provider token by decrypting the stored value and re-encrypting
 * legacy plaintext tokens.
 */
export async function normalizeProviderToken(
  providerId: string,
  encryptedValue: string | null
): Promise<string | null> {
  if (!encryptedValue) {
    return null;
  }

  try {
    const decrypted = decryptSecret(encryptedValue);

    if (decrypted === encryptedValue) {
      // Legacy plaintext token; re-encrypt for future reads.
      try {
        const reEncrypted = encryptSecret(decrypted);
        await query(
          "UPDATE service_providers SET api_key_encrypted = $1, updated_at = NOW() WHERE id = $2",
          [reEncrypted, providerId]
        );
        console.info(
          `normalizeProviderToken: re-encrypted legacy API token for provider ${providerId}`
        );
      } catch (reEncryptErr) {
        console.error(
          `normalizeProviderToken: failed to re-encrypt provider ${providerId} token`,
          reEncryptErr
        );
      }
    }

    return decrypted;
  } catch (err) {
    console.error(
      `normalizeProviderToken: failed to decrypt API token for provider ${providerId}`,
      err
    );
    throw err;
  }
}

export async function getProviderTokenByType(
  providerType: ProviderType
): Promise<{ providerId: string; token: string } | null> {
  const result = await query(
    "SELECT id, api_key_encrypted FROM service_providers WHERE type = $1 AND active = true LIMIT 1",
    [providerType]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  const token = await normalizeProviderToken(row.id, row.api_key_encrypted);

  if (!token) {
    return null;
  }

  return { providerId: row.id, token };
}
