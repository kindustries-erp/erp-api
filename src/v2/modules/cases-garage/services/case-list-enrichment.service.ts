import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import { ErpModuleCategory } from '@/module-config/entities/erp_module_category.entity';
import { KgaraGrossProfit } from '@/kgara-api-core/entities/kgara_gross_profit.entity';
import { KgaraCaseLinkedInvoice } from '@/kgara-api-core/entities/kgara_case_linked_invoice.entity';
import type {
  CaseCategoryRef,
  CaseGrossProfitRef,
} from '../helpers/case-list-item.mapper';
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
    @InjectRepository(ErpModuleCategory)
    private readonly categories: Repository<ErpModuleCategory>,
    @InjectRepository(KgaraGrossProfit)
    private readonly grossProfits: Repository<KgaraGrossProfit>,
  ) {}

  /** Danh mục phân loại theo id (v2 không khai báo quan hệ chéo module). */
  async categoryRefs(
    ids: Array<string | null>,
  ): Promise<Map<string, CaseCategoryRef>> {
    const uniq = [...new Set(ids.filter((i): i is string => !!i))];
    const map = new Map<string, CaseCategoryRef>();
    if (!uniq.length) return map;
    const rows = await this.categories
      .createQueryBuilder('k')
      .select('k.id', 'id')
      .addSelect('k.code', 'code')
      .addSelect('k.name', 'name')
      .where('k.id IN (:...ids)', { ids: uniq })
      .getRawMany<{ id: string; code: string | null; name: string | null }>();
    for (const c of rows) {
      map.set(c.id, { id: c.id, code: c.code ?? null, name: c.name ?? null });
    }
    return map;
  }

  /** Lãi gộp KGara theo `branch|mã chứng từ`, lấy dòng mới nhất mỗi mã. */
  async grossProfitByCode(
    branchId: string,
    codes: string[],
  ): Promise<Map<string, CaseGrossProfitRef>> {
    const map = new Map<string, CaseGrossProfitRef>();
    if (!codes.length) return map;
    const rows = await this.grossProfits.find({
      where: { branchExternalId: branchId, vuViecCode: In(codes) },
      order: { updatedAt: 'ASC' },
    });
    for (const g of rows) {
      map.set(g.vuViecCode as string, {
        revenue: g.doanhThu,
        cost: g.chiPhi,
        profit: g.loiNhuan,
      });
    }
    return map;
  }

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
      const cur = map.get(r.caseId) ?? {
        receipts: 0,
        payments: 0,
        hasReceipt: false,
      };
      if (r.type === 'RECEIPT') {
        cur.receipts += Number(r.amount) || 0;
        cur.hasReceipt = true;
      }
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
