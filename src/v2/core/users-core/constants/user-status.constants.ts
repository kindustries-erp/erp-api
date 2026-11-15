/** Trạng thái tài khoản. Không có trạng thái nháp: tài khoản tạo xong là ACTIVE. */
export const USER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_ACTIVE: UserStatus = 'ACTIVE';
export const USER_STATUS_INACTIVE: UserStatus = 'INACTIVE';
