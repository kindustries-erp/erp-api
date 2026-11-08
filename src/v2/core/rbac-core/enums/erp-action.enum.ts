export enum ErpAction {
  ALL = '*',
  READ = 'read',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  /** Xóa cứng chứng từ nháp. Tách khỏi DELETE (xóa mềm), chỉ cấp cho admin. */
  PURGE = 'purge',
  MANAGE = 'manage',
  APPROVE = 'approve',
  REJECT = 'reject',
}
