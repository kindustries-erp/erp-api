import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraAccountKey } from '../enums/kgara-account.enum';
import { SyncCaseService } from './sync-case.service';

const BRANCH = '0b4d6d3a-55df-492b-abaf-377d84b61d05';
const OJ_GUID = 'uuid-oj-1';
const MAIN_GUID = 'uuid-main-1';

function buildService() {
  const lineManager = {
    getRepository: jest.fn(() => ({
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn(async (e) => e),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    })),
  };
  const repo = (overrides: Record<string, unknown> = {}) => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (e) => e),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    upsert: jest.fn().mockResolvedValue({ identifiers: [] }),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((d) => ({ ...d })),
    manager: {
      find: jest.fn().mockResolvedValue([]),
      transaction: jest.fn((cb) => cb(lineManager)),
    },
    ...overrides,
  });

  const branchRepo = repo();
  const caseRepo = repo();
  const caseServiceRepo = repo();
  const grossProfitRepo = repo();
  const linkedInvoiceRepo = repo();
  const settlementRepo = repo();

  const client = {
    getCases: jest.fn(),
    getReceivables: jest
      .fn()
      .mockResolvedValue({ data: [], pagination: { totalPages: 1 } }),
    getCaseDetail: jest.fn(),
    getGrossProfitDetail: jest
      .fn()
      .mockResolvedValue({ results: { Groups: [] } }),
  };
  const syncRunLogger = {
    createSyncRun: jest.fn().mockResolvedValue({ id: 'run-1' }),
    closeSyncRun: jest.fn().mockResolvedValue(undefined),
  };
  const syncDeletion = {
    detectAndMarkDeletedCases: jest
      .fn()
      .mockResolvedValue({ deletedCount: 0, withLinkedInvoices: [] }),
  };

  const service = new SyncCaseService(
    branchRepo as any,
    caseRepo as any,
    caseServiceRepo as any,
    grossProfitRepo as any,
    linkedInvoiceRepo as any,
    settlementRepo as any,
    client as any,
    syncRunLogger as any,
    syncDeletion as any,
    {} as any,
  );

  return {
    service,
    client,
    branchRepo,
    caseRepo,
    caseServiceRepo,
    syncDeletion,
    lineManager,
  };
}

describe('SyncCaseService (Kgara account scope)', () => {
  it('syncs OJ cases whose list rows have no HdPhieuDichVuID by resolving through receivables', async () => {
    const ctx = buildService();
    ctx.client.getCases.mockResolvedValue({
      data: [
        { ID: 1087553588, SoChungTu: 'GN-PDV2610-0007', TinhTrangDichVu: 3 },
      ],
      pagination: { totalPages: 1 },
    });
    ctx.client.getReceivables.mockResolvedValue({
      data: [{ SoChungTu: 'GN-PDV2610-0007', HdPhieuDichVuID: OJ_GUID }],
      pagination: { totalPages: 1 },
    });

    await ctx.service.syncCasesForBranch(
      BRANCH,
      '2026-01-01',
      '2026-11-03',
      undefined,
      KgaraAccountKey.OJ,
    );

    expect(ctx.client.getReceivables).toHaveBeenCalled();
    expect(ctx.caseRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        hdPhieuDichVuId: OJ_GUID,
        soChungTu: 'GN-PDV2610-0007',
        accountKey: 'OJ',
        classification: 'OJ',
      }),
    );
  });

  it('does not write any case whose GUID cannot be resolved', async () => {
    const ctx = buildService();
    ctx.client.getCases.mockResolvedValue({
      data: [{ ID: 99, SoChungTu: 'GN-UNMAPPED', TinhTrangDichVu: 1 }],
      pagination: { totalPages: 1 },
    });

    await ctx.service.syncCasesForBranch(
      BRANCH,
      '2026-01-01',
      '2026-11-03',
      undefined,
      KgaraAccountKey.OJ,
    );

    expect(ctx.caseRepo.save).not.toHaveBeenCalled();
  });

  it('skips deletion detection when rows were skipped, so unmapped rows are not marked deleted', async () => {
    const ctx = buildService();
    ctx.client.getCases.mockResolvedValue({
      data: [{ ID: 99, SoChungTu: 'GN-UNMAPPED', TinhTrangDichVu: 1 }],
      pagination: { totalPages: 1 },
    });

    await ctx.service.syncCasesForBranch(
      BRANCH,
      '2026-01-01',
      '2026-11-03',
      undefined,
      KgaraAccountKey.OJ,
    );

    expect(ctx.syncDeletion.detectAndMarkDeletedCases).not.toHaveBeenCalled();
  });

  it('refuses to overwrite a case already owned by another account', async () => {
    const ctx = buildService();
    ctx.client.getCases.mockResolvedValue({
      data: [
        {
          HdPhieuDichVuID: MAIN_GUID,
          SoChungTu: 'GR-PDV2610-0001',
          TinhTrangDichVu: 1,
        },
      ],
      pagination: { totalPages: 1 },
    });
    ctx.caseRepo.findOne.mockResolvedValue({
      id: 'case-row-1',
      hdPhieuDichVuId: MAIN_GUID,
      accountKey: 'MAIN',
      rawData: {},
    } as unknown as KgaraCase);

    await ctx.service.syncCasesForBranch(
      BRANCH,
      '2026-01-01',
      '2026-11-03',
      undefined,
      KgaraAccountKey.OJ,
    );

    expect(ctx.caseRepo.save).not.toHaveBeenCalled();
    expect(ctx.syncDeletion.detectAndMarkDeletedCases).not.toHaveBeenCalled();
  });

  it('keeps ListPhieuDichVuChiTiet already stored when the list payload overwrites raw_data', async () => {
    const ctx = buildService();
    const storedLines = [{ HdPhieuDichVuChiTietID: 'd1' }];
    ctx.client.getCases.mockResolvedValue({
      data: [
        {
          HdPhieuDichVuID: MAIN_GUID,
          SoChungTu: 'GR-PDV2610-0001',
          TinhTrangDichVu: 1,
        },
      ],
      pagination: { totalPages: 1 },
    });
    ctx.caseRepo.findOne.mockResolvedValue({
      id: 'case-row-1',
      hdPhieuDichVuId: MAIN_GUID,
      accountKey: 'MAIN',
      rawData: { ListPhieuDichVuChiTiet: storedLines },
    } as unknown as KgaraCase);

    await ctx.service.syncCasesForBranch(
      BRANCH,
      '2026-01-01',
      '2026-11-03',
      undefined,
      KgaraAccountKey.MAIN,
    );

    const saved = ctx.caseRepo.save.mock.calls[0][0];
    expect(saved.rawData.ListPhieuDichVuChiTiet).toEqual(storedLines);
    expect(saved.rawData.SoChungTu).toBe('GR-PDV2610-0001');
  });

  it('soft-deletes stored lines that Kgara no longer returns when the detail has a valid array', async () => {
    const ctx = buildService();
    ctx.caseRepo.findOne.mockResolvedValue({
      id: 'case-row-1',
      hdPhieuDichVuId: MAIN_GUID,
      accountKey: 'MAIN',
    } as unknown as KgaraCase);
    ctx.client.getCaseDetail.mockResolvedValue({
      data: {
        HdPhieuDichVuID: MAIN_GUID,
        SoChungTu: 'GR-PDV2610-0001',
        TinhTrangDichVu: 1,
        ListPhieuDichVuChiTiet: [
          { HdPhieuDichVuChiTietID: 'd1', TienCoThue: 10 },
        ],
      },
      dataAsOf: '2026-11-03T00:00:00Z',
    });
    ctx.lineManager.getRepository = jest.fn(() => ({
      find: jest.fn().mockResolvedValue([
        {
          id: 'row-1',
          hdPhieuDichVuChiTietId: 'd1',
          hdPhieuDichVuId: MAIN_GUID,
          deletedAt: null,
        },
        {
          id: 'row-2',
          hdPhieuDichVuChiTietId: 'd-old',
          hdPhieuDichVuId: MAIN_GUID,
          deletedAt: null,
        },
      ]),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn(async (e) => e),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    })) as any;
    ctx.caseServiceRepo.manager.transaction = jest.fn((cb) =>
      cb(ctx.lineManager),
    );

    await ctx.service.syncCaseDetail(BRANCH, MAIN_GUID, KgaraAccountKey.MAIN);

    expect(ctx.caseServiceRepo.manager.transaction).toHaveBeenCalled();
    const repoFactory = ctx.lineManager.getRepository as jest.Mock;
    const repo = repoFactory.mock.results[0].value;
    expect(repo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });

  it('does not soft-delete lines when the detail has no line array', async () => {
    const ctx = buildService();
    ctx.client.getCaseDetail.mockResolvedValue({
      data: {
        HdPhieuDichVuID: MAIN_GUID,
        SoChungTu: 'GR-PDV2610-0001',
        TinhTrangDichVu: 1,
      },
      dataAsOf: '2026-11-03T00:00:00Z',
    });

    await ctx.service.syncCaseDetail(BRANCH, MAIN_GUID, KgaraAccountKey.MAIN);

    const repoFactory = ctx.lineManager.getRepository as jest.Mock;
    const repo = repoFactory.mock.results.at(-1)?.value;
    expect(repo?.update ?? jest.fn()).not.toHaveBeenCalled();
  });

  it('syncBranches looks up branches by the (externalId, accountKey) pair', async () => {
    const ctx = buildService();
    ctx.client.getCases.mockResolvedValue({
      data: [],
      pagination: { totalPages: 1 },
    });
    const branchClient = {
      getBranches: jest.fn().mockResolvedValue([
        {
          DonViID: BRANCH,
          MaSo: 'GN',
          TenDonVi: 'GREENWAY AUTO - CN2',
          ParentID: 'root',
        },
      ]),
    };
    (ctx.service as any).client = {
      ...(ctx.service as any).client,
      ...branchClient,
    };

    await ctx.service.syncBranches(KgaraAccountKey.OJ);

    expect(ctx.branchRepo.findOne).toHaveBeenCalledWith({
      where: { externalId: BRANCH, accountKey: 'OJ' },
    });
    expect(ctx.branchRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: BRANCH,
        accountKey: 'OJ',
        code: 'GN',
      }),
    );
  });
});
