import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBankTransactionDto } from './create-bank-transaction.dto';

const basePayload = {
  sourceType: 'BANK',
  branchId: '6f1c2a6e-3b1d-4c2e-9a7b-1d2e3f4a5b6c',
  transDate: '2026-10-20T00:00:00.000Z',
  debitAmount: 0,
  creditAmount: 1000,
};

describe('CreateBankTransactionDto cashflow attributes', () => {
  it('accepts valid classification and purpose', async () => {
    const dto = plainToInstance(CreateBankTransactionDto, {
      ...basePayload,
      cashflowClassification: 'OPERATING',
      cashflowPurpose: 'CUSTOMER_PAYMENT',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts null and omitted values (legacy rows stay empty)', async () => {
    const dto = plainToInstance(CreateBankTransactionDto, {
      ...basePayload,
      cashflowClassification: null,
      cashflowPurpose: null,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts new investing and financing purposes', async () => {
    const dto = plainToInstance(CreateBankTransactionDto, {
      ...basePayload,
      cashflowClassification: 'INVESTING',
      cashflowPurpose: 'ASSET_PURCHASE',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects INTERNAL_TRANSFER as classification (it is only a purpose)', async () => {
    const dto = plainToInstance(CreateBankTransactionDto, {
      ...basePayload,
      cashflowClassification: 'INTERNAL_TRANSFER',
      cashflowPurpose: 'INTERNAL_TRANSFER',
    });
    const errors = await validate(dto);
    const props = errors.map((e) => e.property);
    expect(props).toContain('cashflowClassification');
    expect(props).not.toContain('cashflowPurpose');
  });

  it('rejects unknown classification and purpose values', async () => {
    const dto = plainToInstance(CreateBankTransactionDto, {
      ...basePayload,
      cashflowClassification: 'UNKNOWN',
      cashflowPurpose: 'HACKED',
    });
    const errors = await validate(dto);
    const props = errors.map((e) => e.property);
    expect(props).toEqual(
      expect.arrayContaining(['cashflowClassification', 'cashflowPurpose']),
    );
  });
});
