import { createDirectus, rest, staticToken } from '@directus/sdk';
import { ConfigService } from '@nestjs/config';

export const DIRECTUS_CLIENT = 'DIRECTUS_CLIENT';

/**
 * NestJS provider: tạo Directus SDK client có authentication composable.
 * Dùng staticToken của admin để gọi các API cần quyền cao (tạo user, đọc user).
 */
export const directusProvider = {
  provide: DIRECTUS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const url = config.getOrThrow<string>('DIRECTUS_URL');
    const token = config.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');

    return createDirectus(url).with(staticToken(token)).with(rest());
  },
};
