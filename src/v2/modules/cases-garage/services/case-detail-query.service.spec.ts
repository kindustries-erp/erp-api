import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { CaseDetailQueryService } from './case-detail-query.service';
import type { CaseListEnrichmentService } from './case-list-enrichment.service';

function makeService(row: unknown) {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndMapOne: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(row),
  };
  const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
  const enrichment = {
    settlementSums: jest.fn().mockResolvedValue(new Map()),
    linkCounts: jest.fn().mockResolvedValue(new Map()),
  };
  const service = new CaseDetailQueryService(
    repo as unknown as Repository<KgaraCase>,
    enrichment as unknown as CaseListEnrichmentService,
  );
  return { service, qb, enrichment };
}

describe('CaseDetailQueryService', () => {
  it('không có vụ việc (hoặc khác chi nhánh, đã xóa) thì NotFound', async () => {
    const { service, enrichment } = makeService(null);

    await expect(service.findById('b1', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(enrichment.settlementSums).not.toHaveBeenCalled();
  });

  it('luôn ràng buộc chi nhánh và chưa xóa mềm', async () => {
    const { service, qb } = makeService(null);

    await service.findByCode('b1', 'PS1').catch(() => undefined);

    expect(qb.where).toHaveBeenCalledWith('case.soChungTu = :key', {
      key: 'PS1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'case.branchExternalId = :branchId',
      { branchId: 'b1' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith('case.kgaraDeletedAt IS NULL');
  });

  it('trả dòng chi tiết đã chuẩn hóa, không có rawData', async () => {
    const { service } = makeService({
      id: 'c1',
      hdPhieuDichVuId: 'h1',
      soChungTu: 'PS1',
      tienCoThue: '500',
      tienDaThanhToan: '0',
      excludeFromReports: false,
      excludeFromDebt: false,
      rawData: { secret: 1 },
    });

    const item = await service.findById('b1', 'c1');

    expect(item).toMatchObject({ id: 'c1', tienCoThue: 500 });
    expect(item).not.toHaveProperty('rawData');
  });
});
