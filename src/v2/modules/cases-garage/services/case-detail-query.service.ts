import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraGrossProfit } from '@/kgara-api-core/entities/kgara_gross_profit.entity';
import type { CaseListItem } from '../dto/case-list.types';
import { toCaseListItem } from '../helpers/case-list.mapper';
import { CaseListEnrichmentService } from './case-list-enrichment.service';

/**
 * Chi tiết một vụ việc (chỉ đọc), cùng dạng dòng với danh sách. Luôn kiểm chi nhánh: vụ việc của chi nhánh
 * khác coi như không tồn tại. Vụ việc đã xóa mềm không trả ra.
 */
@Injectable()
export class CaseDetailQueryService {
  constructor(
    @InjectRepository(KgaraCase) private readonly cases: Repository<KgaraCase>,
    private readonly enrichment: CaseListEnrichmentService,
  ) {}

  findById(branchId: string, id: string): Promise<CaseListItem> {
    return this.load(branchId, 'case.id = :key', id);
  }

  findByCode(branchId: string, code: string): Promise<CaseListItem> {
    return this.load(branchId, 'case.soChungTu = :key', code);
  }

  private async load(
    branchId: string,
    where: string,
    key: string,
  ): Promise<CaseListItem> {
    const row = await this.cases
      .createQueryBuilder('case')
      .leftJoinAndSelect('case.category', 'cat')
      .leftJoinAndMapOne(
        'case.grossProfit',
        KgaraGrossProfit,
        'gp',
        'gp.vuViecCode = case.soChungTu',
      )
      .where(where, { key })
      .andWhere('case.branchExternalId = :branchId', { branchId })
      .andWhere('case.kgaraDeletedAt IS NULL')
      .getOne();
    if (!row) throw new NotFoundException('Không tìm thấy vụ việc.');

    const [sums, links] = await Promise.all([
      this.enrichment.settlementSums([row.id]),
      this.enrichment.linkCounts([row.id]),
    ]);
    return toCaseListItem(
      row,
      sums.get(row.id),
      links.get(row.id),
      (row as KgaraCase & { grossProfit?: KgaraGrossProfit | null })
        .grossProfit,
    );
  }
}
