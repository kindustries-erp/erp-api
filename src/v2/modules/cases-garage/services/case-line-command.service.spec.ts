import { CaseOrigin } from '../entities/case-garage.enums';
import { CaseLineCommandService } from './case-line-command.service';

const syncLine = {
  id: 'l1',
  externalId: 'E1',
  overrides: {},
  sourceSnapshot: { partsCost: '0.00', description: 'a' },
};

const make = (origin: CaseOrigin, line: Record<string, unknown> = syncLine) => {
  const manager = { update: jest.fn() };
  const ds = { transaction: (cb: (m: unknown) => unknown) => cb(manager) };
  const cases = {
    findOwned: jest
      .fn()
      .mockResolvedValue({ id: 'c1', origin, accountKey: 'MAIN' }),
    reload: jest.fn().mockResolvedValue({ id: 'c1' }),
  };
  const lines = {
    add: jest.fn(),
    remove: jest.fn(),
    replaceOne: jest.fn(),
    toFields: jest.fn().mockReturnValue({ description: 'b' }),
    findLine: jest.fn().mockResolvedValue(line),
    recompute: jest.fn(),
  };
  const svc = new CaseLineCommandService(
    ds as never,
    cases as never,
    lines as never,
  );
  return { svc, manager, lines };
};

describe('CaseLineCommandService', () => {
  it('SYNC: thêm dòng nhập tay không tính lại tổng header', async () => {
    const { svc, lines } = make(CaseOrigin.KGARA_SYNC);
    await svc.add('B1', 'c1', { productCode: 'X' } as never);
    expect(lines.add).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { productCode: 'X' },
      false,
    );
  });

  it('dòng sync: sửa partsCost ghi cột hiệu lực + overrides, không tính lại tổng', async () => {
    const { svc, lines, manager } = make(CaseOrigin.KGARA_SYNC);
    await svc.updatePartsCost('B1', 'c1', 'l1', 12.5);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'l1' },
      { partsCost: '12.50', overrides: { partsCost: true } },
    );
    expect(lines.recompute).not.toHaveBeenCalled();
  });

  it('dòng sync: thay dòng đánh dấu override field khác snapshot', async () => {
    const { svc, manager } = make(CaseOrigin.KGARA_SYNC);
    await svc.replace('B1', 'c1', 'l1', { description: 'b' } as never);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'l1' },
      { description: 'b', overrides: { description: true } },
    );
  });

  it('dòng sync: xóa đặt _deleted, không xóa cứng', async () => {
    const { svc, lines, manager } = make(CaseOrigin.KGARA_SYNC);
    await svc.remove('B1', 'c1', 'l1');
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'l1' },
      { overrides: { _deleted: true } },
    );
    expect(lines.remove).not.toHaveBeenCalled();
  });

  it('dòng nhập tay (xe NATIVE): ghi trực tiếp và tính lại tổng', async () => {
    const { svc, lines, manager } = make(CaseOrigin.NATIVE, {
      id: 'l1',
      externalId: null,
      overrides: {},
    });
    await svc.updatePartsCost('B1', 'c1', 'l1', 5);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'l1' },
      { partsCost: '5.00' },
    );
    expect(lines.recompute).toHaveBeenCalledWith(expect.anything(), 'c1');
    await svc.remove('B1', 'c1', 'l1');
    expect(lines.remove).toHaveBeenCalled();
  });
});
