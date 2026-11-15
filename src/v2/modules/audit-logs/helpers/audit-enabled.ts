import { ConfigService } from '@nestjs/config';

/**
 * Cờ `ENABLE_AUDIT_LOG` (mặc định bật). Có `ConfigService` thì đọc qua nó, không thì đọc `process.env`.
 * Khi tắt: không ghi, không flush, truy vấn trả rỗng an toàn.
 */
export function isAuditLogEnabled(config?: ConfigService): boolean {
  if (config) return config.get<string>('ENABLE_AUDIT_LOG') !== 'false';
  return process.env.ENABLE_AUDIT_LOG !== 'false';
}
