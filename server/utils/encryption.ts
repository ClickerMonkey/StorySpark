import crypto from 'crypto';

// Use a consistent encryption key from environment or generate one
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || (() => {
  console.warn('ENCRYPTION_KEY not found in environment, using default key for development');
  return 'dev-key-32-chars-long-12345678'; // 32 characters for AES-256
})();

const ALGORITHM = 'aes-256-cbc';

export function encryptApiKey(apiKey: string): string {
  if (!apiKey || apiKey.trim() === '') {
    return '';
  }

  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine iv and encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Error encrypting API key:', error);
    throw new Error('Failed to encrypt API key');
  }
}

export function decryptApiKey(encryptedApiKey: string | null): string | null {
  if (!encryptedApiKey || encryptedApiKey.trim() === '') {
    return null;
  }

  try {
    // Handle legacy unencrypted keys (if they don't contain ':' separator)
    if (!encryptedApiKey.includes(':')) {
      console.warn('Found unencrypted API key, will be encrypted on next update');
      return encryptedApiKey;
    }

    const parts = encryptedApiKey.split(':');
    if (parts.length !== 2) {
      console.warn('Invalid encrypted API key format');
      return null;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting API key:', error);
    return null;
  }
}

export function isEncrypted(value: string | null): boolean {
  return !!(value && value.includes(':'));
}