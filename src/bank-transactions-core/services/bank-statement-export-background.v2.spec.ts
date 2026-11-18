import { BankStatementsExportJobsService } from '@/v2/modules/export-jobs-bank-statements';

import { BankStatementExportBackgroundService } from './bank-statement-export-background.service';

const flush = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Hợp đồng bảo toàn file: cùng bộ lọc thì đường V2 (lõi export-jobs-core) và
 * đường cũ (EXPORT_JOBS_V2=false) phải cho cùng buffer, cùng tên file mẫu và
 * cùng luồng tiến độ (processId, total).
 */
describe('BankStatementExportBackgroundService: V2 và cũ cho cùng file', () => {
  const xlsxBuffer = Buffer.from('xlsx-bytes');
  const query: any = {
    sourceType: 'BANK',
    bankAccountId: 'acc-1',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  };

  let excelBuilder: { build: jest.Mock };
  let v2Jobs: BankStatementsExportJobsService;
  let services: BankStatementExportBackgroundService[];

  const build = (withV2: boolean) => {
    const service = new BankStatementExportBackgroundService(
      { manager: { query: jest.fn(), createQueryBuilder: jest.fn() } } as any,
      {
        findOne: jest.fn().mockResolvedValue({ accountNumber: '111-888 ' }),
      } as any,
      { findOne: jest.fn() } as any,
      {
        buildTransactionQueryBuilder: jest
          .fn()
          .mockReturnValue({ getMany: jest.fn().mockResolvedValue([]) }),
      } as any,
      excelBuilder as any,
      withV2 ? v2Jobs : undefined,
    );
    services.push(service);
    return service;
  };

  beforeEach(() => {
    excelBuilder = { build: jest.fn().mockResolvedValue(xlsxBuffer) };
    v2Jobs = new BankStatementsExportJobsService();
    services = [];
  });

  afterEach(() => {
    services.forEach((s) => s.onModuleDestroy());
    v2Jobs.onModuleDestroy();
    delete process.env.EXPORT_JOBS_V2;
  });

  const run = async (service: BankStatementExportBackgroundService) => {
    const events: any[] = [];
    const sub = service.progress$.subscribe((e) => events.push(e));
    const result = await service.startBackgroundExport(query, 'user-1');
    await flush();
    const file = service.getReadyExportFile(result.jobId, 'user-1');
    sub.unsubscribe();
    return { result, file, events };
  };

  it('V2 bật: cùng buffer, tên file và processId với đường cũ', async () => {
    process.env.EXPORT_JOBS_V2 = 'false';
    const legacy = await run(build(true));

    process.env.EXPORT_JOBS_V2 = 'true';
    const v2 = await run(build(true));

    expect(v2.file.buffer.equals(legacy.file.buffer)).toBe(true);
    expect(v2.file.buffer.equals(xlsxBuffer)).toBe(true);
    const nameRe = /^Sao_ke_111-888_\d{8}_\d{4}\.xlsx$/;
    expect(legacy.file.fileName).toMatch(nameRe);
    expect(v2.file.fileName).toMatch(nameRe);
    expect(new Set(v2.events.map((e) => e.processId))).toEqual(
      new Set(['bank-statement-xlsx-export']),
    );
    expect(v2.events.every((e) => e.total === 100)).toBe(true);
    expect(v2.events[v2.events.length - 1]).toMatchObject({
      completed: true,
      ready: true,
    });
  });

  it('không cấp V2 thì luôn dùng cơ chế cũ dù cờ bật', async () => {
    process.env.EXPORT_JOBS_V2 = 'true';
    const { file } = await run(build(false));
    expect(file.buffer.equals(xlsxBuffer)).toBe(true);
    expect(v2Jobs.listHistoryForUser('user-1').total).toBe(0);
  });

  it('V2 bật: job nằm ở lõi V2 (lịch sử V2 có job, canDownload true)', async () => {
    const service = build(true);
    await run(service);
    const history = v2Jobs.listHistoryForUser('user-1');
    expect(history.total).toBe(1);
    expect(history.items[0]).toMatchObject({
      status: 'COMPLETED',
      canDownload: true,
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
  });

  it('V2 bật: gọi lại cùng bộ lọc thì reuse file đã tạo', async () => {
    const service = build(true);
    const first = await run(service);
    const second = await service.startBackgroundExport(query, 'user-1');
    expect(second).toMatchObject({ jobId: first.result.jobId, reused: true });
  });
});
