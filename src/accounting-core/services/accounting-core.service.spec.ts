import { AccountingCoreService } from './accounting-core.service';

describe('AccountingCoreService', () => {
  let service: AccountingCoreService;
  let chartOfAccountRepo: any;
  let journalEntryRepo: any;
  let journalEntryLineRepo: any;

  beforeEach(() => {
    chartOfAccountRepo = {};

    journalEntryRepo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };

    journalEntryLineRepo = {
      create: jest.fn().mockImplementation((data) => data),
    };

    service = new AccountingCoreService(
      chartOfAccountRepo,
      journalEntryRepo,
      journalEntryLineRepo,
    );
  });

  describe('createJournalEntry', () => {
    it('pairs single debit and single credit correctly', async () => {
      const result = await service.createJournalEntry({
        branchId: 'b1',
        date: new Date('2026-07-17'),
        lines: [
          {
            accountId: '152',
            debit: 2500000,
            credit: 0,
            description: 'Line 1',
          },
          {
            accountId: '331',
            debit: 0,
            credit: 2500000,
            description: 'Line 2',
          },
        ],
      });

      expect(result.status).toBe('POSTED');
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0]).toEqual(
        expect.objectContaining({
          accountId: '152',
          debit: 2500000,
          credit: 0,
          description: 'Line 1',
        }),
      );
      expect(result.lines[1]).toEqual(
        expect.objectContaining({
          accountId: '331',
          debit: 0,
          credit: 2500000,
          description: 'Line 2',
        }),
      );
    });

    it('splits debit across multiple credit lines (pro-rata pairing)', async () => {
      const result = await service.createJournalEntry({
        branchId: 'b1',
        date: new Date('2026-07-17'),
        lines: [
          { accountId: '632', debit: 3000000, credit: 0 },
          { accountId: '133', debit: 200000, credit: 0 },
          { accountId: '331', debit: 0, credit: 3200000 },
        ],
      });

      expect(result.lines).toHaveLength(4);
      const totalDebit = result.lines.reduce(
        (sum: number, l: any) => sum + l.debit,
        0,
      );
      const totalCredit = result.lines.reduce(
        (sum: number, l: any) => sum + l.credit,
        0,
      );
      expect(totalDebit).toBe(3200000);
      expect(totalCredit).toBe(3200000);
    });

    it('sets documentDate from input parameter', async () => {
      const docDate = new Date('2026-07-01');
      const result = await service.createJournalEntry({
        branchId: 'b1',
        date: new Date('2026-07-17'),
        documentDate: docDate,
        lines: [
          { accountId: '152', debit: 100, credit: 0 },
          { accountId: '331', debit: 0, credit: 100 },
        ],
      });

      expect(result.documentDate).toEqual(docDate);
    });

    it('generates entryNo with correct prefix for INVOICE source', async () => {
      const result = await service.createJournalEntry({
        branchId: 'b1',
        date: new Date('2026-07-17'),
        entryNoPrefix: 'HĐM',
        sourceType: 'INVOICE',
        lines: [
          { accountId: '152', debit: 100, credit: 0 },
          { accountId: '331', debit: 0, credit: 100 },
        ],
      });

      expect(result.entryNo).toMatch(/^HĐM-20260717-\d+$/);
    });
  });

  describe('generateEntryNo', () => {
    it('increments sequence when same prefix exists in DB', async () => {
      journalEntryRepo.getOne.mockResolvedValueOnce({
        entryNo: 'HĐM-20260717-03',
      });
      const entryNo = await service.generateEntryNo(
        'INVOICE',
        new Date('2026-07-17'),
        'b1',
        false,
        'HĐM',
      );
      expect(entryNo).toBe('HĐM-20260717-04');
    });

    it('starts from 01 when no previous entry exists', async () => {
      journalEntryRepo.getOne.mockResolvedValueOnce(null);
      const entryNo = await service.generateEntryNo(
        'INVOICE',
        new Date('2026-07-17'),
        'b1',
        false,
        'HĐM',
      );
      expect(entryNo).toBe('HĐM-20260717-01');
    });
  });

  describe('getJournalEntries', () => {
    it('queries with pagination, filters and sorting', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([[{ id: 'je-1', entryNo: 'CT-01' }], 1]),
      };
      journalEntryRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getJournalEntries({
        page: 2,
        pageSize: 50,
        branchId: 'b-1',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        sourceType: 'CASHFLOW',
        search: 'Tiền điện',
        sort: '-date',
        column_filters: JSON.stringify({
          _entryNo: ['__ALL_MATCHING__', 'CT-01'],
          _opposingAccount: ['__BLANK__', '331'],
        }),
        column_search: JSON.stringify({ description: 'điện', debit: '1000' }),
      });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(50);
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(qbMock.skip).toHaveBeenCalledWith(50);
      expect(qbMock.take).toHaveBeenCalledWith(50);
      expect(qbMock.andWhere).toHaveBeenCalledWith('je.branchId = :branchId', {
        branchId: 'b-1',
      });
    });
  });

  describe('getJournalEntriesColumnOptions', () => {
    it('returns distinct column options for entryNo', async () => {
      const qbMock: any = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ value: 'CT-01' }, { value: 'CT-02' }]),
      };
      journalEntryRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getJournalEntriesColumnOptions(
        '_entryNo',
        'CT',
        1,
        20,
      );
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({ label: 'CT-01', value: 'CT-01' });
      expect(result.total).toBe(2);
    });

    it('returns distinct column options for description', async () => {
      const qbMock: any = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ value: 'Mua hàng' }]),
      };
      journalEntryRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getJournalEntriesColumnOptions(
        'description',
        'Mua',
        1,
        20,
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({ label: 'Mua hàng', value: 'Mua hàng' });
    });
  });
});
