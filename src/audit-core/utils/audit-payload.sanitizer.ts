const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passphrase/i,
  /secret/i,
  /token/i,
  /accesstoken/i,
  /refreshtoken/i,
  /authorization/i,
  /auth_token/i,
  /bearer/i,
  /cookie/i,
  /apikey/i,
  /api_key/i,
  /private_key/i,
  /privatekey/i,
  /credit_card/i,
  /creditcard/i,
  /card_number/i,
  /cvv/i,
  /cvc/i,
  /pin/i,
];

export interface SanitizeOptions {
  maxStringLength?: number;
  maxArrayLength?: number;
  maxDepth?: number;
}

const DEFAULT_OPTIONS: Required<SanitizeOptions> = {
  maxStringLength: 5000,
  maxArrayLength: 20,
  maxDepth: 6,
};

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function sanitizeAuditPayload(
  data: any,
  options: SanitizeOptions = {},
  currentDepth = 0,
): any {
  if (data === null || data === undefined) {
    return data;
  }

  const { maxStringLength, maxArrayLength, maxDepth } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (currentDepth > maxDepth) {
    return '[DEPTH_LIMIT_EXCEEDED]';
  }

  // Handle Strings (Truncate long strings like base64, raw dumps)
  if (typeof data === 'string') {
    if (data.length > maxStringLength) {
      return `${data.slice(0, maxStringLength)}... [TRUNCATED ${data.length - maxStringLength} chars]`;
    }
    return data;
  }

  // Handle primitives
  if (typeof data !== 'object') {
    return data;
  }

  // Handle Dates
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle Buffers
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
    return `[BUFFER size=${data.length} bytes]`;
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    const sanitizedArray = data
      .slice(0, maxArrayLength)
      .map((item) => sanitizeAuditPayload(item, options, currentDepth + 1));

    if (data.length > maxArrayLength) {
      sanitizedArray.push({
        _notice: `Truncated ${data.length - maxArrayLength} additional items (total: ${data.length})`,
      } as any);
    }
    return sanitizedArray;
  }

  // Handle Objects
  const sanitizedObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      sanitizedObj[key] = '[REDACTED]';
    } else {
      sanitizedObj[key] = sanitizeAuditPayload(
        value,
        options,
        currentDepth + 1,
      );
    }
  }

  return sanitizedObj;
}
