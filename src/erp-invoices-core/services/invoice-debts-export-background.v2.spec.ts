import { InvoiceDebtsExportJobsService } from '@/v2/modules/export-jobs-invoice-debts';

import { InvoicePartnerType } from '../dto/get-invoice-debts.dto';

import { InvoiceDebtsExportBackgroundService } from './invoice-debts-export-background.service';

const flush = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Hợp đồng bảo toàn file: cùng bộ lọc thì đường V2 (lõi export-jobs-core) và
 * đường cũ (EXPORT_JOBS_V2=false) cho cùng buffer, tên file mẫu và lịch sử
 * (kể cả `partnerType`).
 */
describe('InvoiceDebtsExportBackgroundService: V2 và cũ cho cùng file', () => {
  const xlsxBuffer = Buffer.from('debts-xlsx');
  const query: any = {
    partner_type: InvoicePartnerType.SUPPLIER,
    date_from: '2026-01-01',
    date_to: '2026-01-31',
  };

  let debts: { exportDebtsExcel: jest.Mock };
  let v2Jobs: InvoiceDebtsExportJobsService;
  const services: InvoiceDebtsExportBackgroundService[] = [];

  const build = (withV2: boolean) => {
    const service = new InvoiceDebtsExportBackgroundService(
      debts as any,
      withV2 ? v2Jobs : undefined,
    );
    services.push(service);
    return service;
  };

  beforeEach(() => {
    debts = {
      exportDebtsExcel: jest.fn().mockImplementation(async (_q, opts) => {
        opts.onProgress(50, 100, 'Đang xử lý');
        return xlsxBuffer;
      }),
    };
    v2Jobs = new InvoiceDebtsExportJobsService();
  });

  afterEach(() => {
    services.splice(0).forEach((s) => s.onModuleDestroy());
    v2Jobs.onModuleDestroy();
    delete process.env.EXPORT_JOBS_V2;
  });

  const run = async (service: InvoiceDebtsExportBackgroundService) => {
    const result = await service.startBackgroundExport(query, 'user-1');
    await flush();
    const file = service.getReadyExportFile(result.jobId, 'user-1');
    const history = service.listHistoryForUser('user-1');
    return { result, file, history };
  };

  it('V2 và cũ cho cùng buffer, cùng tên file mẫu và cùng partnerType', async () => {
    process.env.EXPORT_JOBS_V2 = 'false';
    const legacy = await run(build(true));

    process.env.EXPORT_JOBS_V2 = 'true';
    const v2 = await run(build(true));

    expect(v2.file.buffer.equals(legacy.file.buffer)).toBe(true);
    const nameRe = /^Bao_cao_cong_no_nha_cung_cap_\d{8}_\d{6}\.xlsx$/;
    expect(legacy.file.fileName).toMatch(nameRe);
    expect(v2.file.fileName).toMatch(nameRe);
    expect(v2.history.items[0]).toMatchObject({
      status: 'COMPLETED',
      canDownload: true,
      partnerType: InvoicePartnerType.SUPPLIER,
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
    expect(legacy.history.items[0]).toMatchObject({
      partnerType: InvoicePartnerType.SUPPLIER,
    });
  });

  it('V2: gọi producer với query gốc và báo tiến độ qua lõi', async () => {
    const { history } = await run(build(true));
    expect(debts.exportDebtsExcel).toHaveBeenCalledWith(
      query,
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
    expect(history.total).toBe(1);
    expect(v2Jobs.listHistoryForUser('user-1').total).toBe(1);
  });

  it('không cấp V2 thì luôn dùng cơ chế cũ dù cờ bật', async () => {
    const { file } = await run(build(false));
    expect(file.buffer.equals(xlsxBuffer)).toBe(true);
    expect(v2Jobs.listHistoryForUser('user-1').total).toBe(0);
  });
});
