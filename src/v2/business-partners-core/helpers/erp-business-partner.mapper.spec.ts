import { ErpBusinessPartner } from '../entities/erp_business_partner.entity';
import {
  toErpBusinessPartnerEntityFields,
  toErpBusinessPartnerResponse,
} from './erp-business-partner.mapper';

describe('ErpBusinessPartner mapper', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const entity = {
    id: 'id-1',
    code: 'sample',
    name: 'sample',
    displayName: 'sample',
    partnerType: 'sample',
    taxCode: 'sample',
    phone: 'sample',
    email: 'sample',
    address: 'sample',
    contactName: 'sample',
    status: 'ACTIVE',
    notes: 'sample',
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
  } as ErpBusinessPartner;

  it('maps the entity to the response DTO without isDeleted', () => {
    expect(toErpBusinessPartnerResponse(entity)).toEqual({
      id: 'id-1',
      code: 'sample',
      name: 'sample',
      displayName: 'sample',
      partnerType: 'sample',
      taxCode: 'sample',
      phone: 'sample',
      email: 'sample',
      address: 'sample',
      contactName: 'sample',
      status: 'ACTIVE',
      notes: 'sample',
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('converts DTO input to entity fields', () => {
    expect(
      toErpBusinessPartnerEntityFields({
        code: 'sample',
        name: 'sample',
        displayName: 'sample',
        partnerType: 'sample',
        taxCode: 'sample',
        phone: 'sample',
        email: 'sample',
        address: 'sample',
        contactName: 'sample',
        status: 'ACTIVE',
        notes: 'sample',
      }),
    ).toEqual({
      code: 'sample',
      name: 'sample',
      displayName: 'sample',
      partnerType: 'sample',
      taxCode: 'sample',
      phone: 'sample',
      email: 'sample',
      address: 'sample',
      contactName: 'sample',
      status: 'ACTIVE',
      notes: 'sample',
    });
  });

  it('keeps only the keys that were provided', () => {
    expect(toErpBusinessPartnerEntityFields({})).toEqual({});
  });
});
