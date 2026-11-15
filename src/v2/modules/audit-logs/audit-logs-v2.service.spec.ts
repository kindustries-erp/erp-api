import { AuditLogsV2Service } from './audit-logs-v2.service';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogQueryService } from './services/audit-log-query.service';

describe('AuditLogsV2Service', () => {
  const row = Object.assign(new AuditLog(), {
    id: '1',
    actionType: 'POST',
    module: 'm',
    status: 'SUCCESS',
    createdAt: new Date(),
  });

  const query = {
    findPage: jest
      .fn()
      .mockResolvedValue({ rows: [row], total: 41, page: 2, pageSize: 20 }),
    findColumnOptions: jest.fn().mockResolvedValue({
      items: [{ label: 'a', value: 'a' }],
      total: 1,
      page: 1,
      pageSize: 20,
    }),
    findTimeline: jest.fn().mockResolvedValue([row]),
  } as unknown as AuditLogQueryService;
  const service = new AuditLogsV2Service(query);

  it('list trả { items, pagination } và không lộ entity', async () => {
    const res = await service.list({});
    expect(res.items[0]).not.toBeInstanceOf(AuditLog);
    expect(res.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 41,
      totalPages: 3,
      next: 3,
      previous: 1,
    });
    expect(res).not.toHaveProperty('total');
  });

  it('columnOptions trả { items, pagination }', async () => {
    const res = await service.columnOptions({ column: 'module' });
    expect(res.items).toEqual([{ label: 'a', value: 'a' }]);
    expect(res.pagination.totalPages).toBe(1);
  });

  it('timeline trả { items }', async () => {
    const res = await service.timeline('core_user', '1');
    expect(res.items).toHaveLength(1);
  });
});
