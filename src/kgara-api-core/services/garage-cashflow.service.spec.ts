import { GarageCashflowService } from './garage-cashflow.service';

describe('GarageCashflowService (Pattern B Sub-Service)', () => {
  let service: GarageCashflowService;
  let mockSettlementRepo: any;
  let mockCaseRepo: any;
  let mockBankTxnRepo: any;
  let mockSettlementCalcService: any;

  beforeEach(() => {
    const mockQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getRawMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
      clone: jest.fn().mockReturnThis(),
    };

    mockSettlementRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      create: jest.fn((dto) => ({ id: 'new-id', ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 'saved-id', ...entity })),
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockCaseRepo = {
      findOne: jest.fn(),
    };

    mockBankTxnRepo = {
      findOne: jest.fn(),
    };

    mockSettlementCalcService = {
      recalculateCaseSettlementSummary: jest.fn().mockResolvedValue(undefined),
    };

    service = new GarageCashflowService(
      mockSettlementRepo,
      mockCaseRepo,
      mockBankTxnRepo,
      mockSettlementCalcService,
    );
  });

  describe('listCashflow', () => {
    it('applies filtersStr and statusTab successfully', async () => {
      const res = await service.listCashflow({
        page: 1,
        pageSize: 20,
        statusTab: 'receipt',
        filtersStr: JSON.stringify({
          settlementType: ['RECEIPT'],
        }),
      });

      expect(mockSettlementRepo.createQueryBuilder).toHaveBeenCalled();
      expect(res.items).toEqual([]);
      expect(res.total).toBe(0);
    });
  });

  describe('createCashflow', () => {
    it('creates a settlement and recalculates case balances if caseId is provided', async () => {
      mockSettlementRepo.findOne.mockResolvedValueOnce({
        id: 'saved-id',
        settlementType: 'RECEIPT',
        amount: 5000000,
        transDate: '2026-10-08',
        caseId: 'case-uuid-1',
        paymentMethod: 'BANK_TRANSFER',
        sourceChannel: 'ON_SYSTEM',
        case: {
          id: 'case-uuid-1',
          soChungTu: 'GR-PDV2610-0011',
          bienSoXe: '49A43568',
        },
      });

      const res = await service.createCashflow({
        settlementType: 'RECEIPT',
        amount: 5000000,
        transDate: '2026-10-08',
        caseId: 'case-uuid-1',
        paymentMethod: 'BANK_TRANSFER',
      });

      expect(mockSettlementRepo.save).toHaveBeenCalled();
      expect(
        mockSettlementCalcService.recalculateCaseSettlementSummary,
      ).toHaveBeenCalledWith('case-uuid-1');
      expect(res.amount).toBe(5000000);
      expect(res.caseCode).toBe('GR-PDV2610-0011');
    });
  });

  describe('deleteCashflow', () => {
    it('deletes settlement and recalculates case balance', async () => {
      mockSettlementRepo.findOne.mockResolvedValueOnce({
        id: 'set-1',
        caseId: 'case-1',
      });

      const res = await service.deleteCashflow('set-1');
      expect(mockSettlementRepo.delete).toHaveBeenCalledWith('set-1');
      expect(
        mockSettlementCalcService.recalculateCaseSettlementSummary,
      ).toHaveBeenCalledWith('case-1');
      expect(res.success).toBe(true);
    });

    it('throws NotFoundException if settlement does not exist', async () => {
      mockSettlementRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.deleteCashflow('not-found')).rejects.toThrow();
    });
  });

  describe('getColumnOptions', () => {
    it('returns options for table filters when no column specified', async () => {
      const options = await service.getColumnOptions();
      expect(options.settlementTypes).toHaveLength(2);
      expect(options.paymentMethods).toHaveLength(4);
      expect(options.payerTypes).toHaveLength(4);
      expect(options.sourceChannels).toHaveLength(2);
    });

    it('queries distinct options when column specified', async () => {
      const res = await service.getColumnOptions({ column: 'partnerName' });
      expect(res).toHaveProperty('items');
      expect(res).toHaveProperty('total');
    });
  });
});
