/** Cặp token trả cho client sau khi đăng nhập hoặc làm mới. */
export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  /** Giây còn lại của access token. */
  expiresIn: number;
  tokenType: 'Bearer';
}

/** Ngữ cảnh client gắn vào session để truy vết. */
export interface AuthClientMeta {
  userAgent?: string;
  ipAddress?: string;
}
