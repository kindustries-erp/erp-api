import { AuditLogQueryService } from '@/v2/modules/audit-logs/services/audit-log-query.service';
import { AuditWriterService } from '@/v2/modules/audit-logs/services/audit-writer.service';
import { AuditCoreService } from './audit-core.service';

describe('AuditCoreService (V1 delegator)', () => {
  const writer = {
    isEnabled: true,
    recordAction: jest.fn().mockResolvedValue(undefined),
    flush: jest.fn().mockResolvedValue(undefined),
  };
  const query = {
    findPage: jest.fn().mockResolvedValue({
      rows: [{ id: 1 }],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
    findColumnOptions: jest.fn(),
    findTimeline: jest.fn().mockResolvedValue([{ id: 1 }]),
  };
  const service = new AuditCoreService(
    writer as unknown as AuditWriterService,
    query as unknown as AuditLogQueryService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('ghi và flush qua writer v2 duy nhất', async () => {
    await service.recordAction({ actionType: 'POST', module: 'm' });
    await service.flush();
    expect(writer.recordAction).toHaveBeenCalledWith({
      actionType: 'POST',
      module: 'm',
    });
    expect(writer.flush).toHaveBeenCalled();
    expect(service.isEnabled).toBe(true);
  });

  it('findAll giữ hình dạng cũ { data, total, page, pageSize }', async () => {
    expect(await service.findAll({})).toEqual({
      data: [{ id: 1 }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('getColumnOptions giữ { items, total, next }', async () => {
    query.findColumnOptions.mockResolvedValue({
      items: [{ label: 'a', value: 'a' }],
      total: 45,
      page: 1,
      pageSize: 20,
    });
    expect(await service.getColumnOptions('module', 'a', 1, 20)).toEqual({
      items: [{ label: 'a', value: 'a' }],
      total: 45,
      next: 2,
    });
    query.findColumnOptions.mockResolvedValue({
      items: [],
      total: 5,
      page: 1,
      pageSize: 20,
    });
    expect((await service.getColumnOptions('module')).next).toBeNull();
  });

  it('timeline trả mảng thuần', async () => {
    expect(await service.getEntityTimeline('t', '1')).toEqual([{ id: 1 }]);
  });
});
