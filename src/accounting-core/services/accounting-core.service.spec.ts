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
});
