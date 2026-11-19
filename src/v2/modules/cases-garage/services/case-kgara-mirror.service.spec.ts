import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraCaseService } from '@/kgara-api-core/entities/kgara_case_service.entity';
import { CaseKgaraMirrorService } from './case-kgara-mirror.service';

describe('CaseKgaraMirrorService', () => {
  const svc = new CaseKgaraMirrorService();

  it('mirrorCase: chỉ ghi nhóm ERP-local sang cột V1 (tên V1), bỏ field nguồn', async () => {
    const manager = { update: jest.fn() };
    await svc.mirrorCase(manager as never, 'c1', {
      internalNotes: 'n',
      excludeFromReports: true,
      licensePlate: 'x',
    });
    expect(manager.update).toHaveBeenCalledWith(
      KgaraCase,
      { id: 'c1' },
      { erpNotes: 'n', excludeFromReports: true },
    );
  });

  it('mirrorCase: không có field ERP-local thì không ghi', async () => {
    const manager = { update: jest.fn() };
    await svc.mirrorCase(manager as never, 'c1', { licensePlate: 'x' });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('mirrorLine: giá vốn sang giaVonPhuTung; thiếu legacyServiceId thì bỏ qua', async () => {
    const manager = { update: jest.fn() };
    await svc.mirrorLine(
      manager as never,
      { legacyServiceId: 's1' },
      { partsCost: '5' },
    );
    expect(manager.update).toHaveBeenCalledWith(
      KgaraCaseService,
      { id: 's1' },
      { giaVonPhuTung: '5.00' },
    );
    await svc.mirrorLine(
      manager as never,
      { legacyServiceId: null },
      { partsCost: '5' },
    );
    expect(manager.update).toHaveBeenCalledTimes(1);
  });
});
