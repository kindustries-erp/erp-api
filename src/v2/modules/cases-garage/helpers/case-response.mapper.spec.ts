import { CaseOrigin, CaseStatus } from '../entities/case-garage.enums';
import type { CaseGarage } from '../entities/case-garage.entity';
import type { CaseServiceGarage } from '../entities/case-service-garage.entity';
import { toCaseResponse } from './case-response.mapper';

describe('toCaseResponse', () => {
  const line = (n: number, del: Date | null = null) =>
    ({
      id: `s${n}`,
      caseId: 'c1',
      lineNumber: n,
      quantity: '2.0000',
      partsCost: null,
      externalDeletedAt: del,
      extraData: {},
    }) as unknown as CaseServiceGarage;

  it('ép tiền về number, ngày về ISO, trả origin và extraData', () => {
    const r = toCaseResponse({
      id: 'c1',
      origin: CaseOrigin.NATIVE,
      caseCode: 'VV-2611-0001',
      branchExternalId: 'B1',
      accountKey: 'MAIN',
      status: CaseStatus.INTAKE,
      totalAmountWithTax: '100.50',
      issuedAt: new Date('2026-11-01T00:00:00Z'),
      createdAt: new Date('2026-11-01T00:00:00Z'),
      updatedAt: new Date('2026-11-01T00:00:00Z'),
      classificationManuallyCleared: false,
      excludeFromReports: false,
      excludeFromDebt: false,
      extraData: { a: 1 },
    } as unknown as CaseGarage);
    expect(r.totalAmountWithTax).toBe(100.5);
    expect(r.issuedAt).toBe('2026-11-01T00:00:00.000Z');
    expect(r.origin).toBe('NATIVE');
    expect(r.extraData).toEqual({ a: 1 });
    expect(r.services).toBeUndefined();
    expect(r).not.toHaveProperty('rawData');
  });

  it('services: bỏ dòng đã xóa phía KGara và sắp theo lineNumber', () => {
    const r = toCaseResponse({
      id: 'c1',
      services: [line(2), line(1), line(3, new Date())],
      extraData: {},
    } as unknown as CaseGarage);
    expect(r.services?.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(r.services?.[0].quantity).toBe(2);
    expect(r.services?.[0].partsCost).toBeNull();
  });
});
