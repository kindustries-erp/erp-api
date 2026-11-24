import 'reflect-metadata';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { BadRequestException, RequestMethod } from '@nestjs/common';
import { RBAC_PERMISSIONS_KEY } from '@/auth/decorators/require-permissions.decorator';
import { CasesGarageWorkshopController } from './cases-garage-workshop.controller';

const proto = CasesGarageWorkshopController.prototype as unknown as Record<
  string,
  () => void
>;
const route = (name: string) => ({
  path: Reflect.getMetadata(PATH_METADATA, proto[name]),
  method: Reflect.getMetadata(METHOD_METADATA, proto[name]),
});
const perms = (name: string) =>
  Reflect.getMetadata(RBAC_PERMISSIONS_KEY, proto[name]);

const make = () => {
  const query = {
    board: jest.fn().mockResolvedValue({ items: [] }),
    timeline: jest.fn().mockResolvedValue([{ id: 'l1' }]),
  };
  const logs = {
    create: jest.fn().mockResolvedValue({ id: 'l1' }),
    update: jest.fn().mockResolvedValue({ id: 'l1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const workers = { list: jest.fn().mockResolvedValue({ items: [] }) };
  const candidates = { search: jest.fn().mockResolvedValue([{ id: 'c1' }]) };
  const tracker = {
    track: jest.fn().mockResolvedValue({ caseId: 'c1' }),
    trackNew: jest.fn().mockResolvedValue({ caseId: 'c2' }),
    untrack: jest.fn().mockResolvedValue(undefined),
  };
  const rbac = { hasPermission: jest.fn().mockResolvedValue(true) };
  return {
    c: new CasesGarageWorkshopController(
      query as never,
      logs as never,
      workers as never,
      candidates as never,
      tracker as never,
      rbac as never,
    ),
    workers,
    query,
    logs,
    candidates,
    tracker,
    rbac,
  };
};

describe('CasesGarageWorkshopController', () => {
  it('route và method đúng thiết kế', () => {
    expect(route('board')).toEqual({
      path: 'workshop/board',
      method: RequestMethod.GET,
    });
    expect(route('timeline')).toEqual({
      path: ':id/progress-logs',
      method: RequestMethod.GET,
    });
    expect(route('createLog')).toEqual({
      path: ':id/progress-logs',
      method: RequestMethod.POST,
    });
    expect(route('updateLog')).toEqual({
      path: 'progress-logs/:logId',
      method: RequestMethod.PATCH,
    });
    expect(route('removeLog')).toEqual({
      path: 'progress-logs/:logId',
      method: RequestMethod.DELETE,
    });
  });

  it('quyền garage_workshop: đọc cần read, ghi/sửa/xóa cần update', () => {
    expect(route('workers')).toEqual({
      path: 'workshop/workers',
      method: RequestMethod.GET,
    });
    for (const m of ['board', 'timeline', 'workers']) {
      expect(perms(m)).toEqual([
        { resource: 'garage_workshop', action: 'read' },
      ]);
    }
    for (const m of ['createLog', 'updateLog', 'removeLog']) {
      expect(perms(m)).toEqual([
        { resource: 'garage_workshop', action: 'update' },
      ]);
    }
  });

  it('thiếu header chi nhánh → 400', () => {
    const { c } = make();
    expect(() => c.board({}, undefined as never)).toThrow(BadRequestException);
  });

  it('chuyển chi nhánh, người dùng và body xuống service; bọc response', async () => {
    const { c, query, logs, workers } = make();
    const req = { user: { sub: 'u1' } };
    await c.workers('thợ', 'B1');
    expect(workers.list).toHaveBeenCalledWith('B1', 'thợ');
    await c.board({ search: 'x' }, 'B1');
    expect(query.board).toHaveBeenCalledWith('B1', { search: 'x' });
    expect(await c.timeline('c1', 'B1')).toEqual({ items: [{ id: 'l1' }] });
    const dto = { kind: 'NOTE', note: 'a' } as never;
    expect(await c.createLog('c1', dto, 'B1', req)).toEqual({
      message: 'Đã ghi tiến độ',
      data: { id: 'l1' },
    });
    expect(logs.create).toHaveBeenCalledWith('B1', 'c1', dto, 'u1');
    await c.updateLog('l1', { note: 'b' }, 'B1', req);
    expect(logs.update).toHaveBeenCalledWith('B1', 'l1', { note: 'b' }, 'u1');
    expect(await c.removeLog('l1', 'B1', req)).toEqual({
      message: 'Đã xóa nhật ký',
    });
    expect(logs.remove).toHaveBeenCalledWith('B1', 'l1', 'u1');
  });

  it('route thêm/bỏ xe và quyền: track-new cần thêm garage:create', () => {
    expect(route('candidates')).toEqual({
      path: 'workshop/candidates',
      method: RequestMethod.GET,
    });
    expect(route('track')).toEqual({
      path: 'workshop/track',
      method: RequestMethod.POST,
    });
    expect(route('trackNew')).toEqual({
      path: 'workshop/track-new',
      method: RequestMethod.POST,
    });
    expect(route('untrack')).toEqual({
      path: 'workshop/track/:caseId',
      method: RequestMethod.DELETE,
    });
    expect(perms('candidates')).toEqual([
      { resource: 'garage_workshop', action: 'read' },
    ]);
    for (const m of ['track', 'untrack']) {
      expect(perms(m)).toEqual([
        { resource: 'garage_workshop', action: 'update' },
      ]);
    }
    expect(perms('trackNew')).toEqual([
      { resource: 'garage_workshop', action: 'update' },
      { resource: 'garage', action: 'create' },
    ]);
  });

  it('track: chỉ hỏi quyền garage:update khi có status', async () => {
    const { c, tracker, rbac } = make();
    const req = { user: { sub: 'u1' } };
    await c.track({ caseId: 'c1' } as never, 'B1', req);
    expect(rbac.hasPermission).not.toHaveBeenCalled();
    expect(tracker.track).toHaveBeenCalledWith(
      'B1',
      { caseId: 'c1' },
      { id: 'u1', canChangeStatus: false },
    );
    rbac.hasPermission.mockResolvedValueOnce(false);
    const dto = { caseId: 'c1', status: 'IN_PROGRESS' } as never;
    await c.track(dto, 'B1', req);
    expect(rbac.hasPermission).toHaveBeenCalledWith('u1', 'garage', 'update');
    expect(tracker.track).toHaveBeenLastCalledWith('B1', dto, {
      id: 'u1',
      canChangeStatus: false,
    });
  });

  it('candidates, track-new và untrack chuyển xuống service', async () => {
    const { c, candidates, tracker } = make();
    expect(await c.candidates({ search: '51G' }, 'B1')).toEqual({
      items: [{ id: 'c1' }],
    });
    expect(candidates.search).toHaveBeenCalledWith('B1', { search: '51G' });
    const dto = { licensePlate: '51G-12345' } as never;
    expect(await c.trackNew(dto, 'B1', { user: { sub: 'u1' } })).toEqual({
      message: 'Đã tạo xe và đưa vào bảng tiến độ',
      data: { caseId: 'c2' },
    });
    expect(tracker.trackNew).toHaveBeenCalledWith('B1', dto, 'u1');
    await c.untrack('c1', 'B1');
    expect(tracker.untrack).toHaveBeenCalledWith('B1', 'c1');
    expect(() => c.untrack('c1', undefined as never)).rejects.toThrow(
      BadRequestException,
    );
  });
});
