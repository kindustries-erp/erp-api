import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_META_KEY = 'auditLogMeta';

export interface AuditLogOptions {
  module?: string;
  actionType?: string;
  entityType?: string;
  skip?: boolean;
}

export const AuditLog = (options: AuditLogOptions) =>
  SetMetadata(AUDIT_LOG_META_KEY, options);
