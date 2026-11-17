import { Logger } from '@nestjs/common';
import {
  GARAGE_LEDGER_PROJECTOR,
  notifyLedgerProjector,
} from './ledger-projector.port';

describe('notifyLedgerProjector', () => {
  const logger = { warn: jest.fn() } as unknown as Logger;
  beforeEach(() => jest.clearAllMocks());

  it('không có ModuleRef thì bỏ qua, không lỗi', async () => {
    const call = jest.fn();
    await notifyLedgerProjector(undefined, logger, call);
    expect(call).not.toHaveBeenCalled();
  });

  it('gọi cổng đã đăng ký theo token, tìm lười (strict: false)', async () => {
    const projector = { projectCase: jest.fn().mockResolvedValue(undefined) };
    const get = jest.fn().mockReturnValue(projector);
    await notifyLedgerProjector({ get } as never, logger, (p) =>
      p.projectCase('c1'),
    );
    expect(get).toHaveBeenCalledWith(GARAGE_LEDGER_PROJECTOR, {
      strict: false,
    });
    expect(projector.projectCase).toHaveBeenCalledWith('c1');
  });

  it('chưa đăng ký hoặc cổng ném lỗi thì chỉ ghi log, không ném', async () => {
    const missing = {
      get: () => {
        throw new Error('not found');
      },
    };
    await expect(
      notifyLedgerProjector(missing as never, logger, async () => undefined),
    ).resolves.toBeUndefined();
    const failing = {
      get: () => ({ projectCase: () => Promise.reject(new Error('boom')) }),
    };
    await notifyLedgerProjector(failing as never, logger, (p) =>
      p.projectCase('c'),
    );
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});
