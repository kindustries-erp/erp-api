import { INestApplication, RequestMethod } from '@nestjs/common';

/** Prefix chung của toàn bộ API (v1). */
export const GLOBAL_PREFIX = 'api/v1';

/**
 * Route thuộc `api/v2/...` không mang prefix v1, nên được loại khỏi prefix chung.
 * Các module v2 khác chỉ dùng cấu hình này khi cần URL v2 riêng.
 */
export const GLOBAL_PREFIX_EXCLUDE = [
  { path: 'api/v2/*path', method: RequestMethod.ALL },
];

export function applyGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: GLOBAL_PREFIX_EXCLUDE });
}
