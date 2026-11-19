/** Nguồn gốc vụ việc: nhập tay ở v2 hay chiếu từ KGara qua V1. */
export enum CaseOrigin {
  /** Tạo ở v2, sửa được mọi field. */
  NATIVE = 'NATIVE',
  /** Chiếu từ `kgara_cases` (V1), chỉ sửa được nhóm ERP-local. */
  KGARA_SYNC = 'KGARA_SYNC',
}

/** Trạng thái vụ việc v2 (ánh xạ từ mã số `tinh_trang_dich_vu` của KGara). */
export enum CaseStatus {
  INTAKE = 'INTAKE',
  QUOTED = 'QUOTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Tài khoản KGara mặc định cho xe nhập tay (V1 có `MAIN` và `OJ`). */
export const DEFAULT_CASE_ACCOUNT_KEY = 'MAIN';
