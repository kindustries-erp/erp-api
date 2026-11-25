import { BadRequestException } from '@nestjs/common';
import { DebtsExportJobsService } from './debts-export-jobs.service';
import type { GarageDebtsExportService } from '@/kgara-api-core/services/garage-debts-export.service';

function makeService(link: { externalId: string } | null = null) {
  const buffer = Buffer.from('xlsx');
  const excel = {
    normalizeFilters: jest.fn((dto: object) => ({ ...dto })),
    exportExcel: jest.fn().mockResolvedValue(buffer),
  };
  const findOne = jest.fn().mockResolvedValue(link);
  const ds = { getRepository: () => ({ findOne }) };
  const service = new DebtsExportJobsService(
    excel as unknown as GarageDebtsExportService,
    ds as never,
  );
  return { service, excel, findOne };
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

  it('startForErpBranch: đổi chi nhánh ERP sang đơn vị KGara qua liên kết', async () => {
    const { service, excel, findOne } = makeService({ externalId: 'KG1' });
    const res = await service.startForErpBranch('customers', {}, 'erp1', 'u1');
    expect(findOne.mock.calls[0][0]).toMatchObject({
      where: { branchId: 'erp1', source: 'KGARA', isDeleted: false },
    });
    expect(res).toBeDefined();
    await new Promise((r) => setImmediate(r));
    expect(excel.exportExcel.mock.calls[0][1]).toBe('KG1');
    service.onModuleDestroy();
  });

  it('startForErpBranch: không chọn chi nhánh hoặc chưa liên kết → 400', async () => {
    const { service } = makeService(null);
    await expect(
      service.startForErpBranch('customers', {}, undefined, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.startForErpBranch('customers', {}, 'erp1', 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    service.onModuleDestroy();
  });
});
