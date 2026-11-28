import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { branchWhere } from '@/v2/core/branches-core';
import type { CaseListItem } from '../dto/case-list.types';
import { CaseGarage } from '../entities/case-garage.entity';
import { toCaseListItem } from '../helpers/case-list-item.mapper';
import { toCaseResponse } from '../helpers/case-response.mapper';
import {
  CaseListEnrichmentService,
  grossProfitKey,
} from './case-list-enrichment.service';

export type CaseDetail = CaseListItem & {
  services: ReturnType<typeof toCaseResponse>['services'];
};

/**
 * Chi tiết một vụ việc (kèm dòng hạng mục). Luôn kiểm chi nhánh: vụ việc của chi nhánh khác coi như
 * không tồn tại. Vụ việc đã xóa mềm (v2 hoặc phía KGara) không trả ra.
 */
@Injectable()
export class CaseDetailQueryService {
  constructor(
    @InjectRepository(CaseGarage)
    private readonly cases: Repository<CaseGarage>,
    private readonly enrichment: CaseListEnrichmentService,
  ) {}

  findById(branchId: string | undefined, id: string): Promise<CaseDetail> {
    return this.load(branchId, { id });
  }

  findByCode(branchId: string | undefined, code: string): Promise<CaseDetail> {
    return this.load(branchId, { caseCode: code });
  }

  private async load(
    branchId: string | undefined,
    key: Partial<CaseGarage>,
  ): Promise<CaseDetail> {
    const row = await this.cases.findOne({
      where: {
        ...key,
        ...branchWhere(branchId),
        isDeleted: false,
        externalDeletedAt: IsNull(),
      } as FindOptionsWhere<CaseGarage>,
      relations: ['services'],
    });
    if (!row) throw new NotFoundException('Không tìm thấy vụ việc.');
    const [sums, links, cats, gp, ojInvoicedIds] = await Promise.all([
      this.enrichment.settlementSums([row.id]),
      this.enrichment.linkCounts([row.id]),
      this.enrichment.categoryRefs([row.categoryId]),
      this.enrichment.grossProfitByCase([row]),
      this.enrichment.ojInvoicedCaseIds([row]),
    ]);
    const item = toCaseListItem(row, {
      settlement: sums.get(row.id),
      links: links.get(row.id),
      category: row.categoryId ? (cats.get(row.categoryId) ?? null) : null,
      grossProfit: gp.get(grossProfitKey(row.caseCode, row.branchExternalId)),
      ojInvoicedIds,
    });
    return { ...item, services: toCaseResponse(row).services };
  }
}
