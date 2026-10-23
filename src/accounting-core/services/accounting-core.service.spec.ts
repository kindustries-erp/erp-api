import { AccountingCoreService } from './accounting-core.service';

describe('AccountingCoreService', () => {
  let service: AccountingCoreService;
  let chartOfAccountRepo: any;
  let journalEntryRepo: any;
  let journalEntryLineRepo: any;
  let sequenceRepo: any;

  beforeEach(() => {
    chartOfAccountRepo = {};
    sequenceRepo = {};

    journalEntryRepo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      manager: {
        query: jest.fn().mockResolvedValue([{ current_value: 1 }]),
      },
    };

    journalEntryLineRepo = {
      create: jest.fn().mockImplementation((data) => data),
    };

    service = new AccountingCoreService(
      chartOfAccountRepo,
      journalEntryRepo,
      journalEntryLineRepo,
      sequenceRepo,
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

      expect(result.entryNo).toBe('HĐM-20260717-0001');
    });
  });

  describe('createJournalEntriesForBranches', () => {
    it('tạo một bút toán cân cho mỗi chi nhánh, tiền chia bình quân, số chứng từ có hậu tố a/b', async () => {
      const saved: any[] = [];
      journalEntryRepo.save = jest.fn().mockImplementation((data) => {
        saved.push(data);
        return Promise.resolve(data);
      });
      jest.spyOn(service, 'generateEntryNo').mockResolvedValue('HĐB-0001');

      await service.createJournalEntriesForBranches({
        branchIds: ['b1', 'b2'],
        date: new Date('2026-07-17'),
        sourceType: 'INVOICE',
        sourceId: 'inv-1',
        entryNoPrefix: 'HĐB',
        lines: [
          { accountId: '152', debit: 100, credit: 0 },
          { accountId: '331', debit: 0, credit: 100 },
        ],
      });

      expect(saved).toHaveLength(2);
      expect(saved.map((e) => e.branchId)).toEqual(['b1', 'b2']);
      expect(saved.map((e) => e.entryNo)).toEqual(['HĐB-0001a', 'HĐB-0001b']);
      for (const entry of saved) {
        const debit = entry.lines.reduce((s, l) => s + l.debit, 0);
        const credit = entry.lines.reduce((s, l) => s + l.credit, 0);
        expect(debit).toBe(credit);
      }
      expect(
        saved.flatMap((e) => e.lines).reduce((s, l) => s + l.debit, 0),
      ).toBe(100);
    });

    it('branchIds rỗng → một bút toán với branchId = null', async () => {
      const saved: any[] = [];
      journalEntryRepo.save = jest.fn().mockImplementation((data) => {
        saved.push(data);
        return Promise.resolve(data);
      });
      jest.spyOn(service, 'generateEntryNo').mockResolvedValue('HĐM-0002');

      await service.createJournalEntriesForBranches({
        branchIds: [],
        date: new Date('2026-07-17'),
        sourceType: 'INVOICE',
        sourceId: 'inv-2',
        lines: [
          { accountId: '152', debit: 50, credit: 0 },
          { accountId: '331', debit: 0, credit: 50 },
        ],
      });

      expect(saved).toHaveLength(1);
      expect(saved[0].branchId).toBeNull();
      expect(saved[0].entryNo).toBe('HĐM-0002');
    });
  });

  describe('generateEntryNo', () => {
    it('increments sequence atomically using database sequence', async () => {
      journalEntryRepo.manager.query.mockResolvedValueOnce([
        { current_value: 5 },
      ]);
      const entryNo = await service.generateEntryNo(
        'INVOICE',
        new Date('2026-07-17'),
        'b1',
        false,
        'HĐM',
      );
      expect(entryNo).toBe('HĐM-20260717-0005');
    });

    it('starts from 0001 when sequence engine returns 1', async () => {
      journalEntryRepo.manager.query.mockResolvedValueOnce([
        { current_value: 1 },
      ]);
      const entryNo = await service.generateEntryNo(
        'INVOICE',
        new Date('2026-07-17'),
        'b1',
        false,
        'HĐM',
      );
      expect(entryNo).toBe('HĐM-20260717-0001');
    });

    it('falls back to MAX query from journal entries when sequence table query fails', async () => {
      journalEntryRepo.manager.query.mockRejectedValueOnce(
        new Error('DB error'),
      );
      journalEntryRepo.getOne.mockResolvedValueOnce({
        entryNo: 'HĐM-20260717-0003',
      });
      const entryNo = await service.generateEntryNo(
        'INVOICE',
        new Date('2026-07-17'),
        'b1',
        false,
        'HĐM',
      );
      expect(entryNo).toBe('HĐM-20260717-0004');
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
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          totalDebit: '5000000',
          totalCredit: '5000000',
          totalLines: '4',
        }),
        getMany: jest.fn().mockResolvedValue([]),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'je-1',
              entryNo: 'CT-01',
              lines: [
                { debit: 2500000, credit: 0 },
                { debit: 0, credit: 2500000 },
              ],
            },
          ],
          2,
        ]),
      };
      qbMock.clone = jest.fn().mockReturnValue(qbMock);
      journalEntryRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getJournalEntries({
        page: 1,
        pageSize: 1,
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

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(1);
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(1);
      expect(result.totals).toEqual({
        grandTotalDebit: 5000000,
        grandTotalCredit: 5000000,
        cumulativeDebit: 2500000,
        cumulativeCredit: 2500000,
        totalLines: 4,
        cumulativeLines: 2,
      });
      expect(qbMock.skip).toHaveBeenCalledWith(0);
      expect(qbMock.take).toHaveBeenCalledWith(1);
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

  describe('getJournalEntryById', () => {
    it('returns null if input is empty or invalid', async () => {
      const result = await service.getJournalEntryById('' as any);
      expect(result).toBeNull();
    });

    it('queries by je.id when given a valid UUID', async () => {
      const mockEntry = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        entryNo: 'UNT-01',
      };
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockEntry),
      };
      journalEntryRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getJournalEntryById(
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      );

      expect(qbMock.where).toHaveBeenCalledWith('je.id = :id', {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      });
      expect(result).toEqual(mockEntry);
    });

    it('queries by je.entryNo when given a non-UUID string like "JE-101"', async () => {
      const mockEntry = {
        id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        entryNo: 'JE-101',
      };
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockEntry),
      };
      journalEntryRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.getJournalEntryById('JE-101');

      expect(qbMock.where).toHaveBeenCalledWith('je.entryNo = :entryNo', {
        entryNo: 'JE-101',
      });
      expect(result).toEqual(mockEntry);
    });
  });

  describe('getChartOfAccountById', () => {
    it('queries by coa.id when given a valid UUID', async () => {
      const mockAccount = {
        id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        accountCode: '1111',
      };
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockAccount),
      };
      chartOfAccountRepo.createQueryBuilder = jest.fn().mockReturnValue(qbMock);

      const result = await service.getChartOfAccountById(
        'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      );

      expect(qbMock.andWhere).toHaveBeenCalledWith('coa.id = :id', {
        id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      });
      expect(result).toEqual(mockAccount);
    });

    it('queries by coa.accountCode when given a non-UUID code like "1111"', async () => {
      const mockAccount = {
        id: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        accountCode: '1111',
      };
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockAccount),
      };
      chartOfAccountRepo.createQueryBuilder = jest.fn().mockReturnValue(qbMock);

      const result = await service.getChartOfAccountById('1111');

      expect(qbMock.andWhere).toHaveBeenCalledWith('coa.accountCode = :code', {
        code: '1111',
      });
      expect(result).toEqual(mockAccount);
    });
  });

  describe('updateJournalEntry', () => {
    it('throws NotFoundException if entry is not found', async () => {
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      journalEntryRepo.createQueryBuilder.mockReturnValue(qbMock);

      await expect(
        service.updateJournalEntry('non-existent-id', { description: 'test' }),
      ).rejects.toThrow('Bút toán không tồn tại');
    });

    it('throws BadRequestException if lines are not balanced (Debit != Credit)', async () => {
      const existingEntry = {
        id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        entryNo: 'UNT-01',
        lines: [],
      };
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existingEntry),
      };
      journalEntryRepo.createQueryBuilder.mockReturnValue(qbMock);

      await expect(
        service.updateJournalEntry('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', {
          lines: [
            { accountId: 'acc-1', debit: 1000, credit: 0 },
            { accountId: 'acc-2', debit: 0, credit: 500 },
          ],
        }),
      ).rejects.toThrow('Hạch toán không cân bằng');
    });

    it('updates header and lines successfully when balanced', async () => {
      const existingEntry = {
        id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        entryNo: 'UNT-01',
        description: 'Old desc',
        branchId: 'b-old',
        lines: [],
      };
      const qbMock: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existingEntry),
      };
      journalEntryRepo.createQueryBuilder.mockReturnValue(qbMock);
      journalEntryRepo.findOne = jest.fn().mockResolvedValue(null);
      journalEntryRepo.save = jest
        .fn()
        .mockImplementation((e) => Promise.resolve(e));
      journalEntryLineRepo.delete = jest.fn().mockResolvedValue(true);
      journalEntryLineRepo.save = jest.fn().mockResolvedValue(true);
      chartOfAccountRepo.find = jest
        .fn()
        .mockResolvedValue([{ id: 'acc-1' }, { id: 'acc-2' }]);

      const result = await service.updateJournalEntry(
        'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
        {
          description: 'New updated desc',
          branchId: 'b-new',
          lines: [
            {
              accountId: 'acc-1',
              debit: 1000,
              credit: 0,
              description: 'Line 1',
            },
            {
              accountId: 'acc-2',
              debit: 0,
              credit: 1000,
              description: 'Line 2',
            },
          ],
        },
      );

      expect(journalEntryLineRepo.delete).toHaveBeenCalledWith({
        journalEntryId: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
      });
      expect(journalEntryLineRepo.save).toHaveBeenCalled();
      expect(journalEntryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'New updated desc',
          branchId: 'b-new',
        }),
      );
      expect(result).toBeDefined();
    });
  });
  describe('reallocateJournalEntriesBySource', () => {
    const existing = {
      date: new Date('2026-07-17'),
      documentDate: null,
      description: 'Hóa đơn',
      subjectName: 'NCC',
      reference: null,
      lines: [
        { accountId: '152', debit: 100, credit: 0, description: 'a' },
        { accountId: '331', debit: 0, credit: 100, description: 'b' },
      ],
    };
    let txManager: any;

    beforeEach(() => {
      txManager = {
        query: jest.fn().mockResolvedValue([{ current_value: 1 }]),
      };
      journalEntryRepo.manager.transaction = jest.fn((run) => run(txManager));
    });

    it('runs read, delete and recreate inside one transaction with the same manager', async () => {
      jest
        .spyOn(service, 'getJournalEntriesBySource')
        .mockResolvedValue([existing] as any);
      const deleteSpy = jest
        .spyOn(service, 'deleteJournalEntryBySource')
        .mockResolvedValue(undefined);
      const createSpy = jest
        .spyOn(service, 'createJournalEntriesForBranches')
        .mockResolvedValue({ id: 'new' } as any);

      const result = await service.reallocateJournalEntriesBySource(
        'inv-1',
        'INVOICE',
        ['b1', 'b2'],
        'HĐM',
      );

      expect(journalEntryRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(service.getJournalEntriesBySource).toHaveBeenCalledWith(
        'inv-1',
        'INVOICE',
        txManager,
      );
      expect(deleteSpy).toHaveBeenCalledWith('inv-1', 'INVOICE', txManager);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          branchIds: ['b1', 'b2'],
          entryNoPrefix: 'HĐM',
        }),
        txManager,
      );
      expect(result).toEqual({ id: 'new' });
    });

    it('propagates a failure during recreate so the transaction is rolled back', async () => {
      jest
        .spyOn(service, 'getJournalEntriesBySource')
        .mockResolvedValue([existing] as any);
      jest
        .spyOn(service, 'deleteJournalEntryBySource')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service, 'createJournalEntriesForBranches')
        .mockRejectedValue(new Error('insert failed'));

      await expect(
        service.reallocateJournalEntriesBySource('inv-1', 'INVOICE', ['b1']),
      ).rejects.toThrow('insert failed');
      expect(journalEntryRepo.manager.transaction).toHaveBeenCalledTimes(1);
    });

    it('returns null without deleting when the source has no entries', async () => {
      jest
        .spyOn(service, 'getJournalEntriesBySource')
        .mockResolvedValue([] as any);
      const deleteSpy = jest.spyOn(service, 'deleteJournalEntryBySource');

      expect(
        await service.reallocateJournalEntriesBySource('inv-1', 'INVOICE', [
          'b1',
        ]),
      ).toBeNull();
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });
});
