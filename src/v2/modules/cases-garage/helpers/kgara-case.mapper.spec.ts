import type { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import type { KgaraCaseService } from '@/kgara-api-core/entities/kgara_case_service.entity';
import { CaseOrigin, CaseStatus } from '../entities/case-garage.enums';
import {
  caseGarageErpLocalToKgara,
  caseServiceErpLocalToKgara,
  kgaraCaseToCaseGarage,
  kgaraServiceToCaseService,
} from './kgara-case.mapper';

const v1 = (over: Partial<KgaraCase> = {}) =>
  ({
    id: 'c1',
    hdPhieuDichVuId: ' HD-1 ',
    soChungTu: 'PDV-001',
    branchExternalId: 'B1',
    accountKey: 'OJ',
    bienSoXe: '30A-123.45',
    soKhung: 'VIN123',
    hangXeCode: 'VF',
    hangXeName: 'VinFast',
    namSanXuat: 2024,
    doiTuongThanhToanCode: 'BH1',
    tinhTrangDichVu: 2,
    tienCoThue: '1500000.5' as unknown as number,
    ngayTiepNhan: new Date('2026-11-01T00:00:00Z'),
    erpNotes: 'ghi chú',
    classification: 'OJ',
    rawData: { x: 1 },
    ...over,
  }) as unknown as KgaraCase;

describe('kgaraCaseToCaseGarage', () => {
  it('gắn origin/legacyCaseId, giữ cùng UUID và map tên EN', () => {
    const r = kgaraCaseToCaseGarage(v1());
    expect(r).toMatchObject({
      id: 'c1',
      legacyCaseId: 'c1',
      origin: CaseOrigin.KGARA_SYNC,
      externalId: 'HD-1',
      caseCode: 'PDV-001',
      branchExternalId: 'B1',
      accountKey: 'OJ',
      licensePlate: '30A-123.45',
      chassisNumber: 'VIN123',
      vehicleBrandCode: 'VF',
      manufactureYear: 2024,
      payerCode: 'BH1',
      status: CaseStatus.IN_PROGRESS,
      kgaraStatusCode: 2,
      totalAmountWithTax: '1500000.50',
      internalNotes: 'ghi chú',
    });
    expect(r).not.toHaveProperty('rawData');
  });

  it('bỏ qua undefined, chuỗi rỗng thành null, mã trạng thái lạ rơi về INTAKE', () => {
    const r = kgaraCaseToCaseGarage(
      v1({ bienSoXe: '  ', soKhung: undefined, tinhTrangDichVu: 77 } as any),
    );
    expect(r.licensePlate).toBeNull();
    expect(r).not.toHaveProperty('chassisNumber');
    expect(r.status).toBe(CaseStatus.INTAKE);
    expect(r.kgaraStatusCode).toBe(77);
  });
});

describe('caseGarageErpLocalToKgara', () => {
  it('chỉ ghi nhóm ERP-local và bỏ field nguồn KGara', () => {
    const r = caseGarageErpLocalToKgara({
      internalNotes: 'x',
      excludeFromDebt: true,
      licensePlate: 'KHÔNG ĐƯỢC GHI',
    });
    expect(r).toEqual({ erpNotes: 'x', excludeFromDebt: true });
  });

  it('round-trip ERP-local giữ nguyên giá trị', () => {
    const fwd = kgaraCaseToCaseGarage(v1());
    const back = caseGarageErpLocalToKgara(fwd);
    expect(back).toMatchObject({ erpNotes: 'ghi chú', classification: 'OJ' });
  });
});

describe('service mapper', () => {
  const line = {
    id: 's1',
    hdPhieuDichVuChiTietId: 'L1',
    accountKey: 'MAIN',
    soLuongHoaDon: 2,
    giaVonPhuTung: '10',
    deletedAt: null,
  } as unknown as KgaraCaseService;

  it('map dòng, gắn caseId/lineNumber/legacyServiceId', () => {
    expect(kgaraServiceToCaseService(line, 'c1', 3)).toMatchObject({
      caseId: 'c1',
      lineNumber: 3,
      legacyServiceId: 's1',
      externalId: 'L1',
      quantity: '2.0000',
      partsCost: '10.00',
      externalDeletedAt: null,
    });
  });

  it('chiều ngược chỉ có giá vốn phụ tùng', () => {
    expect(
      caseServiceErpLocalToKgara({ partsCost: '5', quantity: '9' }),
    ).toEqual({ giaVonPhuTung: '5.00' });
  });
});
