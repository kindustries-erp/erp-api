import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import { KgaraCaseLinkedInvoice } from '@/kgara-api-core/entities/kgara_case_linked_invoice.entity';
import type {
  CaseLinkCounts,
  CaseSettlementSums,
} from '../helpers/case-list.mapper';

/** Số liệu phụ của một trang vụ việc: tổng cấn trừ (RECEIPT/PAYMENT) và hóa đơn liên kết, mỗi loại một truy vấn gộp. */
@Injectable()
export class CaseListEnrichmentService {
  constructor(
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlements: Repository<KgaraCaseSettlement>,
    @InjectRepository(KgaraCaseLinkedInvoice)
    private readonly links: Repository<KgaraCaseLinkedInvoice>,
  ) {}

  async settlementSums(
    ids: string[],
  ): Promise<Map<string, CaseSettlementSums>> {
    const map = new Map<string, CaseSettlementSums>();
    if (!ids.length) return map;
    const rows = await this.settlements
      .createQueryBuilder('s')
      .select('s.caseId', 'caseId')
      .addSelect('s.settlementType', 'type')
      .addSelect('SUM(s.amount)', 'amount')
      .where('s.caseId IN (:...ids)', { ids })
      .groupBy('s.caseId')
      .addGroupBy('s.settlementType')
      .getRawMany<{ caseId: string; type: string; amount: string }>();
    for (const r of rows) {
      const cur = map.get(r.caseId) ?? { receipts: 0, payments: 0 };
      if (r.type === 'RECEIPT') cur.receipts += Number(r.amount) || 0;
      if (r.type === 'PAYMENT') cur.payments += Number(r.amount) || 0;
      map.set(r.caseId, cur);
    }
    return map;
  }

  async linkCounts(ids: string[]): Promise<Map<string, CaseLinkCounts>> {
    const map = new Map<string, CaseLinkCounts>();
    if (!ids.length) return map;
    const rows = await this.links
      .createQueryBuilder('l')
      .select('l.caseDbId', 'caseId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN l.linkType = 'OUT' THEN 1 ELSE 0 END)`,
        'outCount',
      )
      .addSelect(
        `SUM(CASE WHEN l.linkType = 'IN' THEN 1 ELSE 0 END)`,
        'inCount',
      )
      .where('l.caseDbId IN (:...ids)', { ids })
      .groupBy('l.caseDbId')
      .getRawMany<{
        caseId: string;
        total: string;
        outCount: string;
        inCount: string;
      }>();
    for (const r of rows) {
      map.set(r.caseId, {
        total: Number(r.total) || 0,
        outCount: Number(r.outCount) || 0,
        inCount: Number(r.inCount) || 0,
      });
    }
    return map;
  }
}
