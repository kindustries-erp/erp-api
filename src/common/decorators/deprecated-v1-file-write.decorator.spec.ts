import { Logger } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import {
  DEPRECATED_V1_FILE_WRITE_TAG,
  DeprecatedV1FileWriteInterceptor,
} from './deprecated-v1-file-write.decorator';

describe('DeprecatedV1FileWriteInterceptor', () => {
  it('log route, method, user rồi cho request đi tiếp không đổi kết quả', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          route: { path: '/erp-invoices/:id/pdfs' },
          user: { sub: 'u1' },
        }),
      }),
    };
    const result = await lastValueFrom(
      new DeprecatedV1FileWriteInterceptor().intercept(ctx as never, {
        handle: () => of('ok'),
      }),
    );
    expect(result).toBe('ok');
    expect(warn).toHaveBeenCalledWith(
      `${DEPRECATED_V1_FILE_WRITE_TAG} POST /erp-invoices/:id/pdfs user=u1`,
    );
    warn.mockRestore();
  });

  it('thiếu user thì ghi unknown', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'DELETE', originalUrl: '/x' }),
      }),
    };
    await lastValueFrom(
      new DeprecatedV1FileWriteInterceptor().intercept(ctx as never, {
        handle: () => of(1),
      }),
    );
    expect(warn.mock.calls[0][0]).toContain('user=unknown');
    warn.mockRestore();
  });
});
