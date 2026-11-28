import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { KgaraCaseSettlement } from '@/kgara-api-core/entities/kgara_case_settlement.entity';
import { ErpModuleCategory } from '@/module-config/entities/erp_module_category.entity';
import { KgaraGrossProfit } from '@/kgara-api-core/entities/kgara_gross_profit.entity';
import { KgaraCaseLinkedInvoice } from '@/kgara-api-core/entities/kgara_case_linked_invoice.entity';
import { findOjInvoicedCaseIds } from '@/kgara-api-core/helpers/kgara-oj-debt-rule.helper';
import type {
  CaseCategoryRef,
  CaseGrossProfitRef,
} from '../helpers/case-list-item.mapper';
import type {
  CaseLinkCounts,
  CaseSettlementSums,
} from '../helpers/case-list.mapper';

/** Khóa lãi gộp của một vụ việc: mã chứng từ chỉ duy nhất trong một đơn vị KGara nên ghép kèm `branch_external_id`. */
export const grossProfitKey = (
  caseCode: string,
  branchExternalId: string | null,
): string => `${branchExternalId ?? ''}|${caseCode}`;

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

  /**
   * Lãi gộp KGara của các vụ việc, lấy dòng mới nhất mỗi vụ việc. Khớp theo mã chứng từ và đơn vị KGara
   * (`branch_external_id`) của chính vụ việc, để hai đơn vị trùng mã không đè nhau. Khóa map: `grossProfitKey`.
   */
  async grossProfitByCase(
    cases: { caseCode: string; branchExternalId: string | null }[],
  ): Promise<Map<string, CaseGrossProfitRef>> {
    const map = new Map<string, CaseGrossProfitRef>();
    const codes = [...new Set(cases.map((c) => c.caseCode))];
    if (!codes.length) return map;
    const wanted = new Set(
      cases.map((c) => grossProfitKey(c.caseCode, c.branchExternalId)),
    );
    const rows = await this.grossProfits.find({
      where: { vuViecCode: In(codes) },
      order: { updatedAt: 'ASC' },
    });
    for (const g of rows) {
      const key = grossProfitKey(g.vuViecCode as string, g.branchExternalId);
      if (!wanted.has(key)) continue;
      map.set(key, {
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

  /** Phiếu OJ đã gắn hóa đơn đầu ra còn hiệu lực (cùng luật công nợ OJ). */
  ojInvoicedCaseIds(
    rows: { id: string; classification: string | null }[],
  ): Promise<Set<string>> {
    return findOjInvoicedCaseIds(this.links.manager, rows);
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
