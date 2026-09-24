import { SmartAccountMappingService } from './smart-account-mapping.service';

describe('SmartAccountMappingService', () => {
  let service: SmartAccountMappingService;
  let ruleRepo: any;
  let coaRepo: any;

  beforeEach(() => {
    ruleRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };
    coaRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    service = new SmartAccountMappingService(ruleRepo, coaRepo);
  });

  it('resolves ACCRUED payroll expense to 6422 and 334', async () => {
    ruleRepo.findOne.mockResolvedValueOnce({
      categoryKey: 'NHAN_SU_LUONG',
      accrualMode: 'ACCRUED',
      accrualDebitAccountCode: '6422',
      accrualCreditAccountCode: '334',
    });

    coaRepo.findOne
      .mockResolvedValueOnce({ id: 'acc-6422', accountCode: '6422' })
      .mockResolvedValueOnce({ id: 'acc-334', accountCode: '334' });

    const result = await service.resolveExpenseAccounts(
      'NHAN_SU_LUONG',
      'ACCRUED',
    );

    expect(result.debitAccountId).toBe('acc-6422');
    expect(result.debitAccountCode).toBe('6422');
    expect(result.creditAccountId).toBe('acc-334');
    expect(result.creditAccountCode).toBe('334');
  });

  it('resolves ACCRUED rent expense to 6427 and 335', async () => {
    ruleRepo.findOne.mockResolvedValueOnce({
      categoryKey: 'THUE_MAT_BANG',
      accrualMode: 'ACCRUED',
      accrualDebitAccountCode: '6427',
      accrualCreditAccountCode: '335',
    });

    coaRepo.findOne
      .mockResolvedValueOnce({ id: 'acc-6427', accountCode: '6427' })
      .mockResolvedValueOnce({ id: 'acc-335', accountCode: '335' });

    const result = await service.resolveExpenseAccounts(
      'THUE_MAT_BANG',
      'ACCRUED',
    );

    expect(result.debitAccountId).toBe('acc-6427');
    expect(result.creditAccountId).toBe('acc-335');
  });

  it('resolves SETTLED rent expense with invoice to 335, 331, and 1331', async () => {
    ruleRepo.findOne.mockResolvedValueOnce({
      categoryKey: 'THUE_MAT_BANG',
      accrualMode: 'SETTLED',
      settleDebitAccountCode: '335',
      settleCreditAccountCode: '331',
      settleVatAccountCode: '1331',
    });

    coaRepo.findOne
      .mockResolvedValueOnce({ id: 'acc-335', accountCode: '335' })
      .mockResolvedValueOnce({ id: 'acc-331', accountCode: '331' })
      .mockResolvedValueOnce({ id: 'acc-1331', accountCode: '1331' });

    const result = await service.resolveExpenseAccounts(
      'THUE_MAT_BANG',
      'SETTLED',
    );

    expect(result.debitAccountId).toBe('acc-335');
    expect(result.creditAccountId).toBe('acc-331');
    expect(result.vatAccountId).toBe('acc-1331');
  });

  it('falls back to 0001 if T0001 is searched and not found with exact code', async () => {
    coaRepo.findOne
      .mockResolvedValueOnce(null) // exact T0001
      .mockResolvedValueOnce({ id: 'acc-0001', accountCode: '0001' }); // alt 0001

    const result = await service.findAccountByCode('T0001');
    expect(result?.id).toBe('acc-0001');
  });
});
