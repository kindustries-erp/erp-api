/** Một quyền đã cấp cho người dùng (hình dạng tối thiểu, độc lập entity cụ thể). */
export interface RbacPermissionGrant {
  resource: string;
  action: string;
  conditions?: Record<string, unknown> | null;
}

/** Cặp (resource, action) cần kiểm tra. */
export interface RbacPermissionRequirement {
  resource: string;
  action: string;
}
