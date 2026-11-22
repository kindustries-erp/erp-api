import { journalItemCostAmount } from './kgara-case-financial-parser.helper';

export interface JournalItemCost {
  TaiKhoanNoCode?: string | null;
  TaiKhoanCoCode?: string | null;
  SoChungTu?: string | null;
  GiaTriTien?: number | null;
  ChiPhi?: number | null;
  NoiDung?: string | null;
}

export interface CaseCostBreakdown {
  warehousePartsCost: number;
  externalCost: number;
  commissionCost: number;
  /** TK 521: giảm trừ doanh thu, không nằm trong `otherCost`, `totalCost`, `unallocatedCost`. */
  discountCost: number;
  otherCost: number;
  totalCost: number;
  allocatedPartsCost: number;
  unallocatedCost: number;
}

export interface EnrichedCostResult<T = any> {
  lines: T[];
  costBreakdown: CaseCostBreakdown;
  hasEnrichedCosts: boolean;
}

export class KgaraCostEnricherHelper {
  static cleanName(text?: string | null): string {
    if (!text) return '';
    return text
      .replace(/^\[[^\]]*\]\s*-\s*/, '')
      .replace(/^\[([^\]]*)\]$/, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Chuẩn hóa journal đã lưu (kgara_gross_profit) thành index theo hdPhieuDichVuId và vuViecCode.
   * Bản ghi không có journal_items bị bỏ qua.
   */
  static buildJournalIndex(
    rows: Array<{
      hdPhieuDichVuId?: string | null;
      vuViecCode?: string | null;
      rawData?: Record<string, any> | null;
    }>,
  ): {
    byHdId: Map<string, JournalItemCost[]>;
    byCode: Map<string, JournalItemCost[]>;
  } {
    const byHdId = new Map<string, JournalItemCost[]>();
    const byCode = new Map<string, JournalItemCost[]>();
    for (const row of rows) {
      const items = row.rawData?.journal_items;
      if (!Array.isArray(items) || items.length === 0) continue;
      if (row.hdPhieuDichVuId && !byHdId.has(row.hdPhieuDichVuId)) {
        byHdId.set(row.hdPhieuDichVuId, items);
      }
      if (row.vuViecCode && !byCode.has(row.vuViecCode)) {
        byCode.set(row.vuViecCode, items);
      }
    }
    return { byHdId, byCode };
  }

  /** Lấy journal của phiếu: ưu tiên hdPhieuDichVuId, fallback mã vụ việc (số chứng từ). */
  static pickJournal(
    index: {
      byHdId: Map<string, JournalItemCost[]>;
      byCode: Map<string, JournalItemCost[]>;
    },
    hdPhieuDichVuId?: string | null,
    soChungTu?: string | null,
  ): JournalItemCost[] | null {
    if (hdPhieuDichVuId && index.byHdId.has(hdPhieuDichVuId)) {
      return index.byHdId.get(hdPhieuDichVuId) || null;
    }
    if (soChungTu && index.byCode.has(soChungTu)) {
      return index.byCode.get(soChungTu) || null;
    }
    return null;
  }

  /**
   * Đơn giá vốn và tổng vốn của một dòng.
   * Ưu tiên tongVon đã khớp; nếu không có thì tính đơn giá vốn × số lượng.
   */
  static resolveLineCost(line: Record<string, any>): {
    unit: number;
    total: number;
  } {
    const unit = Number(line.giaVonPhuTung ?? line.GiaVonPhuTung ?? 0) || 0;
    const qty = Number(line.soLuongHoaDon ?? line.SoLuongHoaDon ?? 0) || 1;
    const explicitTotal = Number(line.tongVon ?? line.TongVon ?? 0) || 0;
    const total = explicitTotal > 0 ? explicitTotal : unit * qty;
    return { unit, total };
  }

  /** Tổng chi phí xuất kho (TK nợ 1541) của journal, cùng quy tắc với enrichCaseLines. */
  static sumWarehouseCost(journalItems?: JournalItemCost[] | null): number {
    if (!Array.isArray(journalItems)) return 0;
    let sum = 0;
    for (const item of journalItems) {
      const amount = Number(item.ChiPhi ?? item.GiaTriTien ?? 0);
      if (amount <= 0) continue;
      if (String(item.TaiKhoanNoCode || '').trim() === '1541') sum += amount;
    }
    return sum;
  }

  static isManualLine(line: Record<string, any>): boolean {
    return (
      String(line.CostAllocationType ?? line.costAllocationType ?? '') ===
      'MANUAL_ERP'
    );
  }

  /**
   * Khi payload KGara mới thay rawData, giữ lại giá vốn nhập tay (MANUAL_ERP) của dòng cũ
   * (khớp theo id chi tiết) để không bị ghi đè bởi giá vốn xuất kho.
   */
  static carryOverManualLines(
    previousLines: Array<Record<string, any>> | null | undefined,
    newLines: Array<Record<string, any>> | null | undefined,
  ): void {
    if (!Array.isArray(previousLines) || !Array.isArray(newLines)) return;
    const idOf = (l: Record<string, any>) =>
      l.HdPhieuDichVuChiTietID ||
      l.HdPhieuDichVuChiTietId ||
      l.hdPhieuDichVuChiTietId ||
      l.ID ||
      l.Id;
    const manualById = new Map<string, Record<string, any>>();
    for (const l of previousLines) {
      const id = idOf(l);
      if (id && this.isManualLine(l)) manualById.set(String(id), l);
    }
    if (manualById.size === 0) return;
    for (const l of newLines) {
      const prev = manualById.get(String(idOf(l)));
      if (!prev) continue;
      l.GiaVonPhuTung = prev.GiaVonPhuTung ?? prev.giaVonPhuTung;
      l.giaVonPhuTung = l.GiaVonPhuTung;
      l.TongVon = prev.TongVon ?? prev.tongVon;
      l.tongVon = l.TongVon;
      l.CostAllocationType = 'MANUAL_ERP';
      l.costAllocationType = 'MANUAL_ERP';
    }
  }

  static enrichCaseLines<T extends Record<string, any>>(
    lines: T[],
    journalItems?: JournalItemCost[] | null,
  ): EnrichedCostResult<T> {
    const breakdown: CaseCostBreakdown = {
      warehousePartsCost: 0,
      externalCost: 0,
      commissionCost: 0,
      discountCost: 0,
      otherCost: 0,
      totalCost: 0,
      allocatedPartsCost: 0,
      unallocatedCost: 0,
    };

    if (!Array.isArray(lines) || lines.length === 0) {
      return {
        lines: lines || [],
        costBreakdown: breakdown,
        hasEnrichedCosts: false,
      };
    }

    if (!Array.isArray(journalItems) || journalItems.length === 0) {
      return { lines, costBreakdown: breakdown, hasEnrichedCosts: false };
    }

    // 1. Phân loại và tổng hợp chi phí từ Journal
    const warehouseCostsByName = new Map<string, number>();

    for (const item of journalItems) {
      const tkNo = String(
        item.TaiKhoanNoCode ||
          (item as { TaiKhoanNo?: string }).TaiKhoanNo ||
          '',
      ).trim();
      const amount = journalItemCostAmount(item, tkNo);
      if (amount <= 0) continue;

      if (tkNo === '521') {
        breakdown.discountCost += amount;
        continue;
      }
      breakdown.totalCost += amount;

      if (tkNo === '1541') {
        breakdown.warehousePartsCost += amount;
        const cleaned = this.cleanName(item.NoiDung);
        if (cleaned) {
          const current = warehouseCostsByName.get(cleaned) || 0;
          warehouseCostsByName.set(cleaned, current + amount);
        }
      } else if (tkNo === '1542') {
        breakdown.externalCost += amount;
      } else if (tkNo === '1543') {
        breakdown.commissionCost += amount;
      } else {
        breakdown.otherCost += amount;
      }
    }

    // 2. Khớp giá vốn xuất kho (TK 1541) vào từng dòng phụ tùng (LoaiSanPhamCode === 'PT')
    let allocatedTotal = 0;
    const enrichedLines = lines.map((line) => {
      const copy: Record<string, any> = { ...line };
      const itemType = String(
        copy.LoaiSanPhamCode || copy.loaiSanPhamCode || '',
      ).toUpperCase();

      const isPart =
        itemType === 'PT' ||
        (!itemType &&
          !String(copy.NhomInName || copy.nhomInName || '')
            .toLowerCase()
            .includes('công') &&
          !String(copy.NhomInName || copy.nhomInName || '')
            .toLowerCase()
            .includes('dịch vụ'));

      if (!isPart) return copy as T;

      // Giá vốn nhập tay trên ERP luôn thắng giá vốn xuất kho
      if (this.isManualLine(copy)) {
        allocatedTotal += this.resolveLineCost(copy).total;
        return copy as T;
      }

      const name1 = this.cleanName(copy.SanPhamName || copy.sanPhamName);
      const name2 = this.cleanName(copy.NoiDungChiTiet || copy.noiDungChiTiet);

      let matchedCost = 0;
      for (const [jName, cost] of warehouseCostsByName.entries()) {
        if (!jName || cost <= 0) continue;
        if (
          name1 === jName ||
          name2 === jName ||
          (name1.length > 5 &&
            (name1.includes(jName) || jName.includes(name1))) ||
          (name2.length > 5 && (name2.includes(jName) || jName.includes(name2)))
        ) {
          matchedCost += cost;
          warehouseCostsByName.delete(jName);
          break;
        }
      }

      if (matchedCost > 0) {
        const qty = Math.max(
          1,
          Number(copy.SoLuongHoaDon ?? copy.soLuongHoaDon ?? copy.SoLuong ?? 1),
        );
        const unitCost = Math.round(matchedCost / qty);

        copy.GiaVonPhuTung = unitCost;
        copy.giaVonPhuTung = unitCost;
        copy.TongVon = matchedCost;
        copy.tongVon = matchedCost;
        copy.CostAllocationType = 'WAREHOUSE_ISSUE';
        copy.costAllocationType = 'WAREHOUSE_ISSUE';
        allocatedTotal += matchedCost;
      }

      return copy as T;
    });

    breakdown.allocatedPartsCost = allocatedTotal;
    breakdown.unallocatedCost = Math.max(
      0,
      breakdown.totalCost - allocatedTotal,
    );

    return {
      lines: enrichedLines,
      costBreakdown: breakdown,
      hasEnrichedCosts: allocatedTotal > 0,
    };
  }
}
