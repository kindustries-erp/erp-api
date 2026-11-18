import { VinfastPartsExportBackgroundService } from '@/reports-core/services/vinfast-parts-export-background.service';
import { VinfastPartsStockExportBackgroundService } from '@/vinfast-parts/services/vinfast-parts-stock-export-background.service';

import { VinfastPartsExportJobsService } from './services/vinfast-parts-export-jobs.service';
import { VinfastPartsStockExportJobsService } from './services/vinfast-parts-stock-export-jobs.service';

const flush = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Hợp đồng bảo toàn file: cùng bộ lọc thì đường V2 (lõi export-jobs-core) và
 * đường cũ (EXPORT_JOBS_V2=false) cho cùng buffer, tên file mẫu, processId.
 */
describe('Xuất phụ tùng VinFast: V2 và cũ cho cùng file', () => {
  const xlsx = Buffer.from('vinfast-xlsx');
  const executor = async (
    onProgress: (c: number, t: number, m: string) => void,
  ) => {
    onProgress(50, 100, 'Đang xử lý');
    return xlsx;
  };
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((fn) => fn());
    delete process.env.EXPORT_JOBS_V2;
  });

  describe('tracking', () => {
    const query = { dateFrom: '2026-01-01', dateTo: '2026-01-31' };
    const run = async (flag: string) => {
      process.env.EXPORT_JOBS_V2 = flag;
      const v2 = new VinfastPartsExportJobsService();
      const svc = new VinfastPartsExportBackgroundService(v2);
      cleanups.push(() => {
        svc.onModuleDestroy();
        v2.onModuleDestroy();
      });
      const res = await svc.startBackgroundExport(query, 'u1', executor);
      await flush();
      return {
        file: svc.getReadyExportFile(res.jobId, 'u1'),
        history: svc.listHistoryForUser('u1'),
        v2,
      };
    };

    it('cùng buffer và tên file mẫu', async () => {
      const legacy = await run('false');
      const v2 = await run('true');
      const re = /^Bao_cao_phu_tung_VINFAST_\d{8}_\d{6}\.xlsx$/;
      expect(v2.file.buffer.equals(legacy.file.buffer)).toBe(true);
      expect(legacy.file.fileName).toMatch(re);
      expect(v2.file.fileName).toMatch(re);
      expect(v2.history.items[0]).toMatchObject({
        status: 'COMPLETED',
        canDownload: true,
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });
      expect(legacy.v2.listHistoryForUser('u1').total).toBe(0);
    });

    it('thiếu userId vẫn báo lỗi như cũ', async () => {
      process.env.EXPORT_JOBS_V2 = 'true';
      const v2 = new VinfastPartsExportJobsService();
      const svc = new VinfastPartsExportBackgroundService(v2);
      cleanups.push(() => {
        svc.onModuleDestroy();
        v2.onModuleDestroy();
      });
      await expect(
        svc.startBackgroundExport(query, '', executor),
      ).rejects.toThrow('Thiếu thông tin người dùng');
    });
  });

  describe('stock', () => {
    const run = async (flag: string, columnFilters?: string) => {
      process.env.EXPORT_JOBS_V2 = flag;
      const v2 = new VinfastPartsStockExportJobsService();
      const svc = new VinfastPartsStockExportBackgroundService(v2);
      cleanups.push(() => {
        svc.onModuleDestroy();
        v2.onModuleDestroy();
      });
      const res = await svc.startBackgroundExport(
        { columnFilters },
        'u1',
        executor,
      );
      await flush();
      return svc.getReadyExportFile(res.jobId, 'u1');
    };

    it('giữ hậu tố sku khi lọc đúng một sku', async () => {
      const cf = JSON.stringify({ sku: ['ABC123'] });
      const legacy = await run('false', cf);
      const v2 = await run('true', cf);
      const re = /^Bao_cao_phu_tung_VINFAST_ABC123_\d{8}_\d{6}\.xlsx$/;
      expect(legacy.fileName).toMatch(re);
      expect(v2.fileName).toMatch(re);
      expect(v2.buffer.equals(legacy.buffer)).toBe(true);
    });

    it('không có hậu tố khi không lọc sku', async () => {
      const v2 = await run('true');
      expect(v2.fileName).toMatch(
        /^Bao_cao_phu_tung_VINFAST_\d{8}_\d{6}\.xlsx$/,
      );
    });
  });
});
