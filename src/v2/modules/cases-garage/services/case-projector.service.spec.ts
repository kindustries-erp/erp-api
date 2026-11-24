import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { CaseGarage } from '../entities/case-garage.entity';
import { CaseOrigin } from '../entities/case-garage.enums';
import { CaseLineGarage } from '../entities/case-line-garage.entity';
import { CaseProjectorService } from './case-projector.service';

const v1Case = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  hdPhieuDichVuId: 'HD1',
  soChungTu: 'PDV-1',
  branchExternalId: 'B1',
  accountKey: 'OJ',
  bienSoXe: '30A-1',
  soKhung: 'VIN1',
  hangXeCode: 'VF',
  doiTuongThanhToanCode: 'BH1',
  tinhTrangDichVu: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

function make(opts: {
  v1?: Record<string, unknown> | null;
  existing?: Record<string, unknown> | null;
  lines?: Record<string, unknown>[];
  current?: Record<string, unknown>[];
  links?: Record<string, unknown>[];
}) {
  const manager = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === KgaraCase)
        return opts.v1 === undefined ? v1Case() : opts.v1;
      if (entity === CaseGarage) return opts.existing ?? null;
      return null;
    }),
    find: jest.fn(async (entity: unknown) => {
      if (entity === CaseLineGarage) return opts.current ?? [];
      if (entity === (CaseGarage as unknown)) return [];
      // KgaraCaseService hoặc BranchManagementExternalLink theo thứ tự gọi
      return (entity as { name: string }).name === 'KgaraCaseService'
        ? (opts.lines ?? [])
        : (opts.links ?? []);
    }),
    insert: jest.fn(),
    update: jest.fn(),
  };
  const ds = { transaction: (cb: (m: unknown) => unknown) => cb(manager) };
  return { svc: new CaseProjectorService(ds as never), manager };
}

describe('CaseProjectorService', () => {
  it('xe mới: insert KGARA_SYNC cùng UUID, chép chi nhánh/account/xe/payer, gắn branchId từ liên kết', async () => {
    const { svc, manager } = make({
      links: [
        { accountKey: '', branchId: 'erp-1' },
        { accountKey: 'OJ', branchId: 'erp-oj' },
      ],
    });
    await expect(svc.project('c1')).resolves.toBe('created');
    const row = manager.insert.mock.calls[0][1] as Record<string, unknown>;
    expect(row).toMatchObject({
      id: 'c1',
      origin: CaseOrigin.KGARA_SYNC,
      branchExternalId: 'B1',
      accountKey: 'OJ',
      caseCode: 'PDV-1',
      licensePlate: '30A-1',
      chassisNumber: 'VIN1',
      vehicleBrandCode: 'VF',
      payerCode: 'BH1',
      status: 'COMPLETED',
      branchId: 'erp-oj',
      overrides: {},
    });
    expect(row.sourceSnapshot).toMatchObject({
      licensePlate: '30A-1',
      status: 'COMPLETED',
    });
    expect(row.sourceSnapshot).not.toHaveProperty('origin');
  });

  it('chạy lại: field đã override không bị ghi đè nhưng snapshot vẫn cập nhật', async () => {
    const { svc, manager } = make({
      existing: {
        id: 'c1',
        origin: CaseOrigin.KGARA_SYNC,
        overrides: { licensePlate: true },
      },
    });
    await svc.project('c1');
    const patch = manager.update.mock.calls[0][2] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('licensePlate');
    expect(patch).toHaveProperty('caseCode', 'PDV-1');
    expect(patch.sourceSnapshot).toMatchObject({ licensePlate: '30A-1' });
  });

  it('chạy lại: status đã override ở v2 không bị sync ghi đè, snapshot và mã KGara vẫn cập nhật', async () => {
    const { svc, manager } = make({
      existing: {
        id: 'c1',
        origin: CaseOrigin.KGARA_SYNC,
        status: 'INTAKE',
        overrides: { status: true },
      },
    });
    await svc.project('c1');
    const patch = manager.update.mock.calls[0][2] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('status');
    expect(patch).toHaveProperty('kgaraStatusCode', 3);
    expect(patch.sourceSnapshot).toMatchObject({ status: 'COMPLETED' });
  });

  it('chạy lại: update, không insert (không nhân đôi), không ghi đè id/createdAt', async () => {
    const { svc, manager } = make({
      existing: { id: 'c1', origin: CaseOrigin.KGARA_SYNC },
    });
    await expect(svc.project('c1')).resolves.toBe('updated');
    expect(manager.insert).not.toHaveBeenCalled();
    const patch = manager.update.mock.calls[0][2] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('id');
    expect(patch).not.toHaveProperty('createdAt');
  });

  it('không đụng xe NATIVE, bỏ qua V1 thiếu chi nhánh hoặc không tồn tại', async () => {
    expect(
      await make({ existing: { origin: CaseOrigin.NATIVE } }).svc.project('c1'),
    ).toBe('skipped');
    expect(
      await make({ v1: v1Case({ branchExternalId: null }) }).svc.project('c1'),
    ).toBe('skipped');
    expect(await make({ v1: null }).svc.project('c1')).toBe('skipped');
  });

  it('dòng hạng mục: dòng mới insert với lineNumber, dòng đã chiếu thì update theo externalId', async () => {
    const { svc, manager } = make({
      lines: [
        {
          id: 's1',
          hdPhieuDichVuChiTietId: 'L1',
          accountKey: 'OJ',
          soLuongHoaDon: 1,
        },
        {
          id: 's2',
          hdPhieuDichVuChiTietId: 'L2',
          accountKey: 'OJ',
          soLuongHoaDon: 2,
        },
      ],
      current: [{ id: 'v2-s1', externalId: 'L1', overrides: {} }],
    });
    await svc.project('c1');
    const inserted = manager.insert.mock.calls.filter(
      (c) => c[0] === CaseLineGarage,
    );
    expect(inserted).toHaveLength(1);
    expect(inserted[0][1]).toMatchObject({
      externalId: 'L2',
      lineNumber: 2,
      caseId: 'c1',
    });
    expect(manager.update).toHaveBeenCalledWith(
      CaseLineGarage,
      { id: 'v2-s1' },
      expect.objectContaining({ externalId: 'L1' }),
    );
  });

  it('dòng đã _deleted ở v2: chỉ cập nhật snapshot, không hồi sinh', async () => {
    const { svc, manager } = make({
      lines: [
        {
          id: 's1',
          hdPhieuDichVuChiTietId: 'L1',
          accountKey: 'OJ',
          soLuongHoaDon: 1,
        },
      ],
      current: [
        { id: 'v2-s1', externalId: 'L1', overrides: { _deleted: true } },
      ],
    });
    await svc.project('c1');
    const call = manager.update.mock.calls.find((c) => c[0] === CaseLineGarage);
    expect(Object.keys(call?.[2] as object)).toEqual(['sourceSnapshot']);
  });

  it('dòng v1 thiếu hd_phieu_dich_vu_chi_tiet_id: bỏ qua, không insert', async () => {
    const { svc, manager } = make({
      lines: [{ id: 's1', hdPhieuDichVuChiTietId: null, accountKey: 'OJ' }],
    });
    await svc.project('c1');
    expect(
      manager.insert.mock.calls.filter((c) => c[0] === CaseLineGarage),
    ).toHaveLength(0);
  });
});
