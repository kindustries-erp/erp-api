import { BadRequestException, ConflictException } from '@nestjs/common';
import { CaseOrigin } from '../entities/case-garage.enums';
import {
  assertDeletable,
  assertHeaderPatchAllowed,
  assertStatusEditable,
  assertStructureEditable,
} from './case-origin.guard';

describe('case-origin.guard', () => {
  it('NATIVE sửa mọi field', () => {
    expect(() =>
      assertHeaderPatchAllowed(CaseOrigin.NATIVE, {
        licensePlate: 'x',
        services: [],
      }),
    ).not.toThrow();
    expect(() => assertDeletable(CaseOrigin.NATIVE)).not.toThrow();
  });

  it('SYNC: nhóm ERP-local qua, field nguồn KGara bị 400', () => {
    expect(() =>
      assertHeaderPatchAllowed(CaseOrigin.KGARA_SYNC, {
        internalNotes: 'x',
        excludeFromDebt: true,
        classification: undefined,
      }),
    ).not.toThrow();
    expect(() =>
      assertHeaderPatchAllowed(CaseOrigin.KGARA_SYNC, { licensePlate: 'x' }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertHeaderPatchAllowed(CaseOrigin.KGARA_SYNC, { services: [] }),
    ).toThrow(BadRequestException);
  });

  it('SYNC: không xóa (409), không đổi trạng thái, không sửa cấu trúc dòng', () => {
    expect(() => assertDeletable(CaseOrigin.KGARA_SYNC)).toThrow(
      ConflictException,
    );
    expect(() => assertStatusEditable(CaseOrigin.KGARA_SYNC)).toThrow(
      BadRequestException,
    );
    expect(() => assertStructureEditable(CaseOrigin.KGARA_SYNC)).toThrow(
      BadRequestException,
    );
  });
});
