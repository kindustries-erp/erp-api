import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { CaseGarage } from '../entities/case-garage.entity';
import { CaseDetailQueryService } from './case-detail-query.service';
import type { CaseListEnrichmentService } from './case-list-enrichment.service';

function makeService(row: unknown) {
  const repo = { findOne: jest.fn().mockResolvedValue(row) };
  const enrichment = {
    settlementSums: jest.fn().mockResolvedValue(new Map()),
    linkCounts: jest.fn().mockResolvedValue(new Map()),
    categoryRefs: jest.fn().mockResolvedValue(new Map()),
    grossProfitByCase: jest.fn().mockResolvedValue(new Map()),
  };
  const service = new CaseDetailQueryService(
    repo as unknown as Repository<CaseGarage>,
    enrichment as unknown as CaseListEnrichmentService,
  );
  return { service, repo, enrichment };
}

describe('CaseDetailQueryService', () => {
  it('không có vụ việc (khác chi nhánh, đã xóa) thì NotFound', async () => {
    const { service, enrichment } = makeService(null);
    await expect(service.findById('b1', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(enrichment.settlementSums).not.toHaveBeenCalled();
  });

  it('có chọn chi nhánh ERP thì ràng buộc branchId, chưa xóa mềm và chưa bị KGara xóa', async () => {
    const { service, repo } = makeService(null);
    await service.findByCode('b1', 'PS1').catch(() => undefined);
    const where = repo.findOne.mock.calls[0][0].where;
    expect(where).toMatchObject({
      caseCode: 'PS1',
      branchId: 'b1',
      isDeleted: false,
    });
    expect(where).not.toHaveProperty('branchExternalId');
    expect(where.externalDeletedAt).toBeDefined();
  });

  it('không chọn chi nhánh thì không lọc chi nhánh', async () => {
    const { service, repo } = makeService(null);
    await service.findById(undefined, 'x').catch(() => undefined);
    const where = repo.findOne.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: 'x', isDeleted: false });
    expect(where).not.toHaveProperty('branchId');
    expect(where).not.toHaveProperty('branchExternalId');
  });

  it('trả chi tiết kèm services (bỏ dòng đã xóa phía KGara), không có rawData', async () => {
    const { service } = makeService({
      id: 'c1',
      origin: 'NATIVE',
      caseCode: 'PS1',
      branchExternalId: 'b1',
      totalAmountWithTax: '500',
      paidAmount: '0',
      excludeFromReports: false,
      excludeFromDebt: false,
      classificationManuallyCleared: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      extraData: {},
      services: [
        { id: 's1', caseId: 'c1', lineNumber: 1, quantity: '1', extraData: {} },
        {
          id: 's2',
          caseId: 'c1',
          lineNumber: 2,
          externalDeletedAt: new Date(),
          extraData: {},
        },
      ],
    });
    const item = await service.findById('b1', 'c1');
    expect(item).toMatchObject({
      id: 'c1',
      caseCode: 'PS1',
      totalAmountWithTax: 500,
    });
    expect(item.services?.map((s) => s.id)).toEqual(['s1']);
    expect(item).not.toHaveProperty('rawData');
  });
});
