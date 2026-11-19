import { Logger } from '@nestjs/common';
import {
  GARAGE_CASE_PROJECTOR,
  notifyCaseProjector,
} from './case-projector.port';

describe('notifyCaseProjector', () => {
  const logger = { warn: jest.fn() } as unknown as Logger;

  it('gọi projectCase theo token đã đăng ký', async () => {
    const projectCase = jest.fn().mockResolvedValue(undefined);
    const moduleRef = { get: jest.fn().mockReturnValue({ projectCase }) };
    await notifyCaseProjector(moduleRef as never, logger, 'c1');
    expect(moduleRef.get).toHaveBeenCalledWith(GARAGE_CASE_PROJECTOR, {
      strict: false,
    });
    expect(projectCase).toHaveBeenCalledWith('c1');
  });

  it('bỏ qua khi thiếu moduleRef hoặc caseId; lỗi chỉ log, không ném', async () => {
    await expect(
      notifyCaseProjector(undefined, logger, 'c1'),
    ).resolves.toBeUndefined();
    const moduleRef = { get: jest.fn() };
    await notifyCaseProjector(moduleRef as never, logger, null);
    expect(moduleRef.get).not.toHaveBeenCalled();
    const bad = {
      get: jest.fn(() => {
        throw new Error('no provider');
      }),
    };
    await expect(
      notifyCaseProjector(bad as never, logger, 'c1'),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
