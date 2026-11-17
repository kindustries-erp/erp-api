import { BadRequestException } from '@nestjs/common';
import { DebtsExportJobsService } from './debts-export-jobs.service';
import type { GarageDebtsExportService } from '@/kgara-api-core/services/garage-debts-export.service';

function makeService() {
  const buffer = Buffer.from('xlsx');
  const excel = {
    normalizeFilters: jest.fn((dto: object) => ({ ...dto })),
    exportExcel: jest.fn().mockResolvedValue(buffer),
  };
  const service = new DebtsExportJobsService(
    excel as unknown as GarageDebtsExportService,
  );
  return { service, excel };
}

describe('DebtsExportJobsService', () => {
  it('chặn khi thiếu chi nhánh hoặc người dùng', () => {
    const { service } = makeService();
    expect(() => service.start('customers', {}, '', 'u1')).toThrow(
      BadRequestException,
    );
    expect(() => service.start('customers', {}, 'b1', '')).toThrow(
      BadRequestException,
    );
    service.onModuleDestroy();
  });

  it('bắt đầu job, gọi producer với chi nhánh và loại đúng', async () => {
    const { service, excel } = makeService();

    const result = service.start(
      'suppliers',
      { from: '2026-08-01' },
      'b1',
      'u1',
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(result.jobId).toEqual(expect.any(String));
    expect(excel.exportExcel).toHaveBeenCalledWith(
      'suppliers',
      'b1',
      { from: '2026-08-01' },
      expect.any(Function),
    );
    service.onModuleDestroy();
  });

  it('fingerprint gồm chi nhánh: cùng bộ lọc khác chi nhánh không dùng lại file', async () => {
    const { service } = makeService();

    const a = service.start('customers', {}, 'b1', 'u1');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const b = service.start('customers', {}, 'b2', 'u1');

    expect(b.reused).toBe(false);
    expect(b.jobId).not.toBe(a.jobId);
    service.onModuleDestroy();
  });

  it('mỗi loại có runner riêng', () => {
    const { service } = makeService();
    expect(service.runner('customers')).not.toBe(service.runner('suppliers'));
    service.onModuleDestroy();
  });
});
