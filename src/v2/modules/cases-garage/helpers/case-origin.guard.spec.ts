import { BadRequestException } from '@nestjs/common';
import { CaseOrigin } from '../entities/case-garage.enums';
import { assertHeaderPatchAllowed } from './case-origin.guard';

describe('case-origin.guard', () => {
  it('NATIVE sửa mọi field', () => {
    expect(() =>
      assertHeaderPatchAllowed(CaseOrigin.NATIVE, {
        licensePlate: 'x',
        caseCode: 'y',
        services: [],
      }),
    ).not.toThrow();
  });

  it('SYNC: field override được (kể cả trạng thái, biển số, ngày) qua; extraData qua', () => {
    expect(() =>
      assertHeaderPatchAllowed(CaseOrigin.KGARA_SYNC, {
        licensePlate: 'x',
        status: 'COMPLETED',
        receivedAt: '2026-01-01',
        internalNotes: 'n',
        extraData: {},
        classification: undefined,
      }),
    ).not.toThrow();
  });

  it('SYNC: định danh/nguồn, tiền công nợ và services bị 400', () => {
    for (const patch of [
      { caseCode: 'x' },
      { externalId: 'x' },
      { origin: 'NATIVE' },
      { paidAmount: '1' },
      { services: [] },
    ]) {
      expect(() =>
        assertHeaderPatchAllowed(CaseOrigin.KGARA_SYNC, patch),
      ).toThrow(BadRequestException);
    }
  });
});
