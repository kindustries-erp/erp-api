import { BankManagement } from '../entities/bank-management.entity';
import { toBankManagementResponse } from './bank-management.mapper';

describe('BankManagement mapper', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const entity = {
    id: 'b1-uuid',
    extraData: { notes: 'test bank' },
    code: 'VCB',
    shortName: 'Vietcombank',
    name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
    bin: '970436',
    logoUrl: 'https://api.vietqr.io/img/VCB.png',
    aliases: ['Vietcombank', 'VCB'],
    isActive: true,
    transferSupported: true,
    lookupSupported: true,
    syncedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    isDeleted: false,
  } as BankManagement;

  it('maps entity correctly to BankManagementResponseDto', () => {
    const res = toBankManagementResponse(entity);
    expect(res).toEqual({
      id: 'b1-uuid',
      code: 'VCB',
      shortName: 'Vietcombank',
      name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
      bin: '970436',
      logoUrl: 'https://api.vietqr.io/img/VCB.png',
      aliases: ['Vietcombank', 'VCB'],
      isActive: true,
      transferSupported: true,
      lookupSupported: true,
      syncedAt: createdAt,
      extraData: { notes: 'test bank' },
      createdAt,
      updatedAt: createdAt,
    });
  });

  it('handles nullable logoUrl and undefined extraData gracefully', () => {
    const partialEntity = {
      ...entity,
      logoUrl: undefined,
      extraData: undefined,
      aliases: undefined,
      syncedAt: undefined,
    } as unknown as BankManagement;

    const res = toBankManagementResponse(partialEntity);
    expect(res.logoUrl).toBeNull();
    expect(res.extraData).toEqual({});
    expect(res.aliases).toEqual([]);
    expect(res.syncedAt).toBeNull();
  });
});
