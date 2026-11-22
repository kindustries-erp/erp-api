/** Thời hạn refresh token: 30 ngày (giây). Khớp v1 để token đổi qua lại không lệch hạn. */
export const REFRESH_TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

/** Thời hạn access token mặc định khi `JWT_EXPIRES_IN` thiếu hoặc sai định dạng (giây). */
export const DEFAULT_ACCESS_TOKEN_SECONDS = 8 * 3600;

export const TOKEN_TYPE_BEARER = 'Bearer';
