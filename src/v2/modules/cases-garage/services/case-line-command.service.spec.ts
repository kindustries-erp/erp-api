import { BadRequestException } from '@nestjs/common';
import { CaseOrigin } from '../entities/case-garage.enums';
import { CaseLineCommandService } from './case-line-command.service';

const make = (origin: CaseOrigin) => {
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
    findLine: jest.fn().mockResolvedValue({ id: 'l1', legacyServiceId: 'v1l' }),
    recompute: jest.fn(),
  };
  const mirror = { mirrorLine: jest.fn() };
  const svc = new CaseLineCommandService(
    ds as never,
    cases as never,
    lines as never,
    mirror as never,
  );
  return { svc, manager, lines, mirror };
};

describe('CaseLineCommandService', () => {
  it('SYNC: không thêm dòng (400), nhưng sửa partsCost và mirror V1', async () => {
    const { svc, lines, mirror, manager } = make(CaseOrigin.KGARA_SYNC);
    await expect(svc.add('B1', 'c1', {} as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await svc.updatePartsCost('B1', 'c1', 'l1', 12.5);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'l1' },
      { partsCost: '12.50' },
    );
    expect(mirror.mirrorLine).toHaveBeenCalled();
    expect(lines.recompute).not.toHaveBeenCalled();
  });

  it('NATIVE: thêm dòng và sửa partsCost tính lại tổng', async () => {
    const { svc, lines, mirror } = make(CaseOrigin.NATIVE);
    await svc.add('B1', 'c1', { productCode: 'X' } as never);
    expect(lines.add).toHaveBeenCalled();
    await svc.updatePartsCost('B1', 'c1', 'l1', 5);
    expect(lines.recompute).toHaveBeenCalledWith(expect.anything(), 'c1');
    expect(mirror.mirrorLine).not.toHaveBeenCalled();
  });
});
