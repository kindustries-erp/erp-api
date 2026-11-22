import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditLogQueryService } from './audit-log-query.service';

function makeQb(rows: unknown[] = [], total = 0, raw: unknown[] = []) {
  const qb: Record<string, jest.Mock> = {};
  [
    'andWhere',
    'where',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
    'select',
    'addSelect',
    'groupBy',
    'offset',
    'limit',
  ].forEach((m) => (qb[m] = jest.fn().mockReturnValue(qb)));
  qb.getManyAndCount = jest.fn().mockResolvedValue([rows, total]);
  qb.getRawMany = jest.fn().mockResolvedValue(raw);
  qb.clone = jest.fn().mockReturnValue(qb);
  return qb;
}

function setup(qb = makeQb(), enabled = 'true') {
  const repository = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    find: jest.fn().mockResolvedValue([]),
  } as unknown as Repository<AuditLog>;
  const config = {
    get: jest.fn(() => enabled),
  } as unknown as ConfigService;
  return { service: new AuditLogQueryService(repository, config), repository };
}

describe('AuditLogQueryService', () => {
  it('findPage áp lọc, mặc định sắp createdAt DESC và phân trang', async () => {
    const qb = makeQb([{ id: 1 }], 1);
    const { service } = setup(qb);
    const res = await service.findPage({
      module: 'users',
      actionType: 'POST, PATCH',
      dateTo: '2026-11-15',
      page: 2,
      pageSize: 10,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('log.module = :module', {
      module: 'users',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'log.actionType IN (:...actionTypes)',
      { actionTypes: ['POST', 'PATCH'] },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('log.createdAt <= :dateTo', {
      dateTo: '2026-11-15 23:59:59.999',
    });
    expect(qb.orderBy).toHaveBeenCalledWith('log.createdAt', 'DESC');
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(res).toEqual({ rows: [{ id: 1 }], total: 1, page: 2, pageSize: 10 });
  });

  it('findPage sắp theo sorts hợp lệ và bỏ qua cột ngoài whitelist', async () => {
    const qb = makeQb();
    const { service } = setup(qb);
    await service.findPage({ sorts: ['-actorEmail', 'hack; DROP'] });
    expect(qb.addOrderBy).toHaveBeenCalledWith('log.actorEmail', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledTimes(1);
    expect(qb.orderBy).not.toHaveBeenCalled();
  });

  it('findPage lọc cột: giá trị, ô trống và bỏ qua JSON lỗi', async () => {
    const qb = makeQb();
    const { service } = setup(qb);
    await service.findPage({
      column_filters: JSON.stringify({ module: ['a', '__BLANK__'] }),
    });
    expect(qb.andWhere).toHaveBeenCalledTimes(1);
    await expect(
      service.findPage({ column_filters: '{not json', column_search: '{x' }),
    ).resolves.toBeDefined();
  });

  it('trả rỗng an toàn khi ENABLE_AUDIT_LOG=false', async () => {
    const { service, repository } = setup(makeQb(), 'false');
    expect(await service.findPage({})).toEqual({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    expect(await service.findColumnOptions({ column: 'module' })).toMatchObject(
      { items: [], total: 0 },
    );
    expect(await service.findTimeline('user', '1')).toEqual([]);
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('findColumnOptions trả rỗng với cột ngoài whitelist', async () => {
    const { service, repository } = setup();
    const res = await service.findColumnOptions({ column: 'password' });
    expect(res.items).toEqual([]);
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('findColumnOptions gom giá trị, phân trang và loại cột đang gợi ý khỏi lọc chéo', async () => {
    const qb = makeQb([], 0, [{ value: 'users' }, { value: 'auth' }]);
    const { service } = setup(qb);
    const res = await service.findColumnOptions({
      column: 'module',
      filters: JSON.stringify({ module: ['x'], status: ['FAIL'] }),
      page: 1,
      pageSize: 20,
    });
    expect(res.items).toEqual([
      { label: 'users', value: 'users' },
      { label: 'auth', value: 'auth' },
    ]);
    expect(res.total).toBe(2);
    const filterCalls = qb.andWhere.mock.calls.filter((c) =>
      String(c[0]).includes('IN (:...c_opt_flt_'),
    );
    expect(filterCalls).toHaveLength(1);
    expect(String(filterCalls[0][0])).toContain('log.status');
  });

  it('findTimeline sắp cũ đến mới theo entity', async () => {
    const { service, repository } = setup();
    await service.findTimeline('core_user', 'u1');
    expect(repository.find).toHaveBeenCalledWith({
      where: { entityType: 'core_user', entityId: 'u1' },
      order: { createdAt: 'ASC' },
    });
  });
});
