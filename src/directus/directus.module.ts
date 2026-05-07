import { Module, Global } from '@nestjs/common';
import { directusProvider } from './directus.provider';

/**
 * Global module: inject DIRECTUS_CLIENT vào bất kỳ module nào mà không cần import lại.
 */
@Global()
@Module({
  providers: [directusProvider],
  exports: [directusProvider],
})
export class DirectusModule {}
