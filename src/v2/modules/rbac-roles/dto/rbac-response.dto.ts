/** Hình dạng response của API rbac-core (giữ đúng contract v1 mà erp-web đang dùng). */

export interface RoleUserResponse {
  id: string;
  email: string;
}

/** Một dòng trong danh sách role (GET roles). */
export interface RoleListItemResponse {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  createdAt: Date;
  users: RoleUserResponse[];
}

/** Role sau khi tạo/cập nhật (POST/PATCH roles). */
export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionResponse {
  id: string;
  roleId: string;
  resource: string;
  action: string;
  conditions: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleListResponse {
  items: RoleListItemResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
