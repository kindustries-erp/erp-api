import {
  AbstractAuditWriterService,
  AuditLogRow,
} from './abstract-audit-writer.service';

class TestWriter extends AbstractAuditWriterService {
  enabled = true;
  batches: AuditLogRow[][] = [];
  failNext = false;

  get isEnabled(): boolean {
    return this.enabled;
  }

  protected insertBatch(rows: AuditLogRow[]): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('db down'));
    }
    this.batches.push(rows);
    return Promise.resolve();
  }
}

describe('AbstractAuditWriterService', () => {
  let writer: TestWriter;

  beforeEach(() => {
    writer = new TestWriter();
  });

  afterEach(async () => {
    await writer.onModuleDestroy();
  });

  it('đệm trong RAM, chỉ ghi khi flush và che trường nhạy cảm', async () => {
    await writer.recordAction({
      actionType: 'CREATE',
      module: 'users',
      afterSnapshot: { password: 'secretPassword', name: 'User 1' },
    });
    expect(writer.batches).toHaveLength(0);

    await writer.flush();

    expect(writer.batches).toHaveLength(1);
    expect(writer.batches[0][0].afterSnapshot).toEqual({
      password: '[REDACTED]',
      name: 'User 1',
    });
    expect(writer.batches[0][0].status).toBe('SUCCESS');
  });

  it('flush ngay khi đủ 50 bản ghi', async () => {
    for (let i = 0; i < 50; i++) {
      await writer.recordAction({ actionType: 'POST', module: 'm' });
    }
    await Promise.resolve();
    await Promise.resolve();
    expect(writer.batches).toHaveLength(1);
    expect(writer.batches[0]).toHaveLength(50);
  });

  it('không đệm và không ghi khi tắt ENABLE_AUDIT_LOG', async () => {
    writer.enabled = false;
    await writer.recordAction({ actionType: 'POST', module: 'm' });
    await writer.flush();
    expect(writer.batches).toHaveLength(0);
  });

  it('đưa lô lỗi trở lại hàng đợi và ghi lại ở lần flush sau', async () => {
    await writer.recordAction({ actionType: 'POST', module: 'm' });
    writer.failNext = true;
    await writer.flush();
    expect(writer.batches).toHaveLength(0);

    await writer.flush();
    expect(writer.batches).toHaveLength(1);
    expect(writer.batches[0]).toHaveLength(1);
  });

  it('cắt message và user-agent quá dài', async () => {
    await writer.recordAction({
      actionType: 'POST',
      module: 'm',
      message: 'x'.repeat(3000),
      userAgent: 'u'.repeat(900),
    });
    await writer.flush();
    expect(writer.batches[0][0].message).toHaveLength(2000);
    expect(writer.batches[0][0].userAgent).toHaveLength(500);
  });

  it('flush khi module bị hủy để không mất log', async () => {
    await writer.recordAction({ actionType: 'POST', module: 'm' });
    await writer.onModuleDestroy();
    expect(writer.batches).toHaveLength(1);
  });
});
