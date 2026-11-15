/** Alias của entity trong query builder. */
export const AUDIT_ALIAS = 'log';

const COLUMN_FIELDS: Record<string, string> = {
  actorEmail: 'actorEmail',
  actionType: 'actionType',
  module: 'module',
  entityType: 'entityType',
  entityId: 'entityId',
  httpMethod: 'httpMethod',
  status: 'status',
  uiScreen: 'uiScreen',
  createdAt: 'createdAt',
};

/** Whitelist cột cho lọc, tìm theo cột và gợi ý. Trả null khi khóa không hợp lệ. */
export function mapAuditColumnToSqlField(column: string): string | null {
  const property = COLUMN_FIELDS[column];
  return property ? `${AUDIT_ALIAS}.${property}` : null;
}
