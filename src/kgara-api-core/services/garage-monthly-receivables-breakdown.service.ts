import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { ErpInvoice } from '../../erp-invoices-core/entities/erp_invoice.entity';
import type {
  MonthlyReceivablesBreakdownResponse,
  MonthlyReceivablesGroupItem,
  MonthlyReceivablesCaseItem,
} from '../dto/garage-monthly-receivables-breakdown.dto';

@Injectable()
export class GarageMonthlyReceivablesBreakdownService {
  private readonly logger = new Logger(
    GarageMonthlyReceivablesBreakdownService.name,
  );

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseSettlement)
    private readonly settlementRepo: Repository<KgaraCaseSettlement>,
    @InjectRepository(KgaraCaseLinkedInvoice)
    private readonly linkedInvoiceRepo: Repository<KgaraCaseLinkedInvoice>,
  ) {}

  private parseMonth(month: string) {
    let y = '';
    let m = '';
    if (month.includes('-')) {
      const parts = month.split('-');
      y = parts[0];
      m = parts[1].padStart(2, '0');
    } else if (month.includes('/')) {
      const parts = month.split('/');
      m = parts[0].padStart(2, '0');
      y = parts[1];
    }
    if (!y || !m || isNaN(Number(y)) || isNaN(Number(m))) {
      const now = new Date();
      y = String(now.getFullYear());
      m = String(now.getMonth() + 1).padStart(2, '0');
    }
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    return {
      dateFrom: `${y}-${m}-01 00:00:00`,
      dateTo: `${y}-${m}-${String(lastDay).padStart(2, '0')} 23:59:59.999`,
      monthKey: `${y}-${m}`,
      monthLabel: `Tháng ${m}/${y}`,
    };
  }

  private isInsuranceBuyer(name?: string): boolean {
    if (!name) return false;
    const lower = name.toLowerCase();
    return (
      lower.includes('bảo hiểm') ||
      lower.includes('bao hiem') ||
      lower.includes('pvi') ||
      lower.includes('bảo việt') ||
      lower.includes('bao viet') ||
      lower.includes('pti') ||
      lower.includes('pjico') ||
      lower.includes('bic') ||
      lower.includes('mic') ||
      lower.includes('vbi') ||
      lower.includes('bsh') ||
      lower.includes('liberty') ||
      lower.includes('bảo long') ||
      lower.includes('bao long') ||
      lower.includes('aaa') ||
      lower.includes('vietinbank')
    );
  }

  async getMonthlyReceivablesBreakdown(
    month: string,
    branchId?: string,
  ): Promise<MonthlyReceivablesBreakdownResponse> {
    const { dateFrom, dateTo, monthKey, monthLabel } = this.parseMonth(month);

    // 1. Query các vụ việc hoàn thành trong tháng
    const qb = this.caseRepo
      .createQueryBuilder('c')
      .where('c.kgara_deleted_at IS NULL')
      .andWhere('(c.exclude_from_reports IS NOT TRUE)')
      .andWhere('(c.exclude_from_debt IS NOT TRUE)')
      .andWhere('(c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9)')
      .andWhere('c.ngay_hoan_thanh_cong_viec >= :dateFrom', { dateFrom })
      .andWhere('c.ngay_hoan_thanh_cong_viec <= :dateTo', { dateTo });

    if (branchId) {
      qb.andWhere(
        '(c.branch_external_id = :branchId OR c.branch_external_id IS NULL)',
        { branchId },
      );
    }

    const cases = await qb
      .orderBy('c.ngay_hoan_thanh_cong_viec', 'ASC')
      .getMany();

    if (cases.length === 0) {
      return {
        month: monthKey,
        monthLabel,
        summary: {
          totalBilled: 0,
          totalPaid: 0,
          totalRemaining: 0,
          collectionRate: 0,
          caseCount: 0,
          customer: {
            billed: 0,
            paid: 0,
            remaining: 0,
            rate: 0,
            caseCount: 0,
            withInvoiceAmount: 0,
            noInvoiceAmount: 0,
            vatAmount: 0,
            vatWithoutInvoiceAmount: 0,
          },
          insurance: {
            billed: 0,
            paid: 0,
            remaining: 0,
            rate: 0,
            caseCount: 0,
            withInvoiceAmount: 0,
            noInvoiceAmount: 0,
            vatAmount: 0,
            vatWithoutInvoiceAmount: 0,
          },
          warning: {
            hasVatWithoutInvoice: false,
            totalVatWithoutInvoice: 0,
            casesWithVatNoInvoiceCount: 0,
          },
        },
        insuranceCompanies: [],
        customerPartners: [],
        allGroups: [],
      };
    }

    const caseIds = cases.map((c) => c.id);

    // 2. Query settlements (Thu tiền) theo caseId
    const settlements = await this.settlementRepo
      .createQueryBuilder('s')
      .select([
        's.case_id AS "caseId"',
        's.amount AS "amount"',
        's.payer_type AS "payerType"',
        's.settlement_type AS "settlementType"',
      ])
      .where('s.case_id IN (:...caseIds)', { caseIds })
      .andWhere("s.settlement_type = 'RECEIPT'")
      .getRawMany();

    const settlementsMap = new Map<
      string,
      { kh: number; bh: number; total: number }
    >();
    for (const s of settlements) {
      if (!s.caseId) continue;
      const cur = settlementsMap.get(s.caseId) || { kh: 0, bh: 0, total: 0 };
      const amt = Number(s.amount) || 0;
      cur.total += amt;
      if (s.payerType === 'BH') {
        cur.bh += amt;
      } else {
        cur.kh += amt;
      }
      settlementsMap.set(s.caseId, cur);
    }

    // 3. Query linked OUT invoices
    const linkedInvoices = await this.linkedInvoiceRepo
      .createQueryBuilder('l')
      .innerJoin(ErpInvoice, 'i', 'l.invoiceId = i.id')
      .select([
        'l.caseDbId AS "caseId"',
        'i.id AS "invoiceId"',
        'i.invoice_no AS "invoiceNo"',
        'i.serial_no AS "serialNo"',
        'i.buyer_name AS "buyerName"',
        'i.buyer_tax_code AS "buyerTaxCode"',
        'i.total_amount AS "totalAmount"',
        'i.vat_amount AS "vatAmount"',
      ])
      .where('l.caseDbId IN (:...caseIds)', { caseIds })
      .andWhere("l.linkType = 'OUT'")
      .getRawMany();

    const invoicesMap = new Map<
      string,
      Array<{
        invoiceId: string;
        invoiceNo: string;
        serialNo?: string;
        buyerName: string;
        buyerTaxCode: string;
        totalAmount: number;
        vatAmount: number;
      }>
    >();
    for (const inv of linkedInvoices) {
      const list = invoicesMap.get(inv.caseId) || [];
      list.push({
        invoiceId: inv.invoiceId,
        invoiceNo: inv.invoiceNo,
        serialNo: inv.serialNo,
        buyerName: (inv.buyerName || '').trim(),
        buyerTaxCode: (inv.buyerTaxCode || '').trim(),
        totalAmount: Number(inv.totalAmount) || 0,
        vatAmount: Number(inv.vatAmount) || 0,
      });
      invoicesMap.set(inv.caseId, list);
    }

    // 4. Phân rã dữ liệu từng vụ việc
    let totalBilled = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    let custBilled = 0;
    let custPaid = 0;
    let custRemaining = 0;
    let custWithInv = 0;
    let custNoInv = 0;
    let custVatTotal = 0;
    let custVatNoInv = 0;
    let custCaseCount = 0;

    let insBilled = 0;
    let insPaid = 0;
    let insRemaining = 0;
    let insWithInv = 0;
    let insNoInv = 0;
    let insVatTotal = 0;
    let insVatNoInv = 0;
    let insCaseCount = 0;

    const warnCaseIds = new Set<string>();

    const insGroupMap = new Map<
      string,
      {
        companyName: string;
        taxCode: string;
        hasInvoice: boolean;
        invoiceNos: Set<string>;
        hasVat: boolean;
        vatAmount: number;
        vatWarning: boolean;
        billed: number;
        paid: number;
        remaining: number;
        cases: MonthlyReceivablesCaseItem[];
      }
    >();

    const custGroupMap = new Map<
      string,
      {
        customerName: string;
        buyerName: string;
        taxCode: string;
        hasInvoice: boolean;
        invoiceNos: Set<string>;
        hasVat: boolean;
        vatAmount: number;
        vatWarning: boolean;
        billed: number;
        paid: number;
        remaining: number;
        cases: MonthlyReceivablesCaseItem[];
      }
    >();

    for (const c of cases) {
      const raw = c.rawData || {};
      const targetRev = Number(c.tienCoThue) || 0;

      // Phải thu BH
      let phaiThuBH = 0;
      if (raw?.TienThanhToanBH != null && !isNaN(Number(raw.TienThanhToanBH))) {
        phaiThuBH = Number(raw.TienThanhToanBH);
      } else if (
        raw?.XeLamBaoHiem === true &&
        raw?.TienBaoHiemDuyet != null &&
        !isNaN(Number(raw.TienBaoHiemDuyet))
      ) {
        phaiThuBH = Math.max(0, Number(raw.TienBaoHiemDuyet));
      }

      // Phải thu KH
      let phaiThuKH = 0;
      if (raw?.TienThanhToanKH != null && !isNaN(Number(raw.TienThanhToanKH))) {
        phaiThuKH = Number(raw.TienThanhToanKH);
      } else if (!raw?.XeLamBaoHiem) {
        phaiThuKH = targetRev;
      } else {
        phaiThuKH = Math.max(0, targetRev - phaiThuBH);
      }

      // Thuế VAT từ KGara
      const vatTotal = Number(raw?.TienThue) || 0;
      const vatKH = Number(raw?.TienThueKH) || (phaiThuBH <= 0 ? vatTotal : 0);
      const vatBH =
        Number(raw?.TienThueBH) ||
        (phaiThuBH > 0 ? Math.max(0, vatTotal - vatKH) : 0);

      // Đã thu (Settlements)
      const setInfo = settlementsMap.get(c.id);
      let daThuKH = 0;
      let daThuBH = 0;
      if (setInfo) {
        daThuKH = setInfo.kh;
        daThuBH = setInfo.bh;
      } else {
        const paidTotal = Number(c.tienDaThanhToan) || 0;
        if (phaiThuBH <= 0) {
          daThuKH = paidTotal;
        } else {
          daThuKH = Math.min(phaiThuKH, paidTotal);
          daThuBH = Math.max(0, paidTotal - daThuKH);
        }
      }

      const conPhaiThuKH = Math.max(0, phaiThuKH - daThuKH);
      const conPhaiThuBH = Math.max(0, phaiThuBH - daThuBH);

      totalBilled += targetRev;
      totalPaid += daThuKH + daThuBH;
      totalRemaining += conPhaiThuKH + conPhaiThuBH;

      // Invoices matching
      const invList = invoicesMap.get(c.id) || [];
      let bhInvoice = invList.find((i) => this.isInsuranceBuyer(i.buyerName));
      if (
        !bhInvoice &&
        phaiThuBH > 0 &&
        invList.length === 1 &&
        raw?.XeLamBaoHiem
      ) {
        if (Math.abs(invList[0].totalAmount - phaiThuBH) <= 1000) {
          bhInvoice = invList[0];
        }
      }

      let khInvoice = invList.find(
        (i) => i !== bhInvoice && !this.isInsuranceBuyer(i.buyerName),
      );
      if (!khInvoice && invList.length > 0) {
        khInvoice = invList.find((i) => i !== bhInvoice);
      }

      // ── Xử lý luồng BẢO HIỂM ──
      if (phaiThuBH > 0) {
        insCaseCount++;
        insBilled += phaiThuBH;
        insPaid += daThuBH;
        insRemaining += conPhaiThuBH;
        insVatTotal += vatBH;

        const hasInvoice = Boolean(bhInvoice);
        const vatWarning = vatBH > 0 && !hasInvoice;
        if (hasInvoice) insWithInv += phaiThuBH;
        else insNoInv += phaiThuBH;
        if (vatWarning) {
          insVatNoInv += vatBH;
          warnCaseIds.add(c.id);
        }

        const compName =
          bhInvoice?.buyerName ||
          (vatWarning
            ? 'Bảo hiểm chưa xuất / chưa đính kèm HĐ'
            : 'Bảo hiểm chưa có HĐ');
        const key = bhInvoice?.buyerName
          ? `INS_${bhInvoice.buyerName}`
          : 'INS__NO_INVOICE__';

        const existing = insGroupMap.get(key) || {
          companyName: compName,
          taxCode: bhInvoice?.buyerTaxCode || '',
          hasInvoice,
          invoiceNos: new Set<string>(),
          hasVat: vatBH > 0,
          vatAmount: 0,
          vatWarning: false,
          billed: 0,
          paid: 0,
          remaining: 0,
          cases: [],
        };

        if (bhInvoice?.invoiceNo) existing.invoiceNos.add(bhInvoice.invoiceNo);
        if (vatWarning) existing.vatWarning = true;
        if (vatBH > 0) existing.hasVat = true;
        existing.vatAmount += vatBH;
        existing.billed += phaiThuBH;
        existing.paid += daThuBH;
        existing.remaining += conPhaiThuBH;
        existing.cases.push({
          id: c.id,
          soChungTu: c.soChungTu || '',
          bienSoXe: c.bienSoXe || '',
          khachHangName: c.khachHangName || '',
          khachHangCode: c.khachHangCode,
          amount: phaiThuBH,
          paid: daThuBH,
          remaining: conPhaiThuBH,
          vatAmount: vatBH,
          invoiceNo: bhInvoice?.invoiceNo,
          invoiceId: bhInvoice?.invoiceId,
          buyerName: bhInvoice?.buyerName,
          vatWarning,
        });

        insGroupMap.set(key, existing);
      }

      // ── Xử lý luồng KHÁCH HÀNG ──
      if (phaiThuKH > 0) {
        custCaseCount++;
        custBilled += phaiThuKH;
        custPaid += daThuKH;
        custRemaining += conPhaiThuKH;
        custVatTotal += vatKH;

        const hasInvoice = Boolean(khInvoice);
        const vatWarning = vatKH > 0 && !hasInvoice;
        if (hasInvoice) custWithInv += phaiThuKH;
        else custNoInv += phaiThuKH;
        if (vatWarning) {
          custVatNoInv += vatKH;
          warnCaseIds.add(c.id);
        }

        const buyerTitle =
          khInvoice?.buyerName ||
          c.khachHangName ||
          (vatWarning
            ? 'Khách hàng chưa xuất / chưa đính kèm HĐ'
            : 'Khách hàng chưa có HĐ');
        const key = khInvoice?.buyerName
          ? `CUST_${khInvoice.buyerName}`
          : `CUST_${c.khachHangName || 'UNKNOWN'}`;

        const existing = custGroupMap.get(key) || {
          customerName: c.khachHangName || 'Khách lẻ',
          buyerName: buyerTitle,
          taxCode: khInvoice?.buyerTaxCode || '',
          hasInvoice,
          invoiceNos: new Set<string>(),
          hasVat: vatKH > 0,
          vatAmount: 0,
          vatWarning: false,
          billed: 0,
          paid: 0,
          remaining: 0,
          cases: [],
        };

        if (khInvoice?.invoiceNo) existing.invoiceNos.add(khInvoice.invoiceNo);
        if (vatWarning) existing.vatWarning = true;
        if (vatKH > 0) existing.hasVat = true;
        existing.vatAmount += vatKH;
        existing.billed += phaiThuKH;
        existing.paid += daThuKH;
        existing.remaining += conPhaiThuKH;
        existing.cases.push({
          id: c.id,
          soChungTu: c.soChungTu || '',
          bienSoXe: c.bienSoXe || '',
          khachHangName: c.khachHangName || '',
          khachHangCode: c.khachHangCode,
          amount: phaiThuKH,
          paid: daThuKH,
          remaining: conPhaiThuKH,
          vatAmount: vatKH,
          invoiceNo: khInvoice?.invoiceNo,
          invoiceId: khInvoice?.invoiceId,
          buyerName: khInvoice?.buyerName,
          vatWarning,
        });

        custGroupMap.set(key, existing);
      }
    }

    // 5. Chuẩn hóa groups sang Array
    const insuranceCompanies: MonthlyReceivablesGroupItem[] = Array.from(
      insGroupMap.entries(),
    ).map(([key, item]) => {
      const rate =
        item.billed > 0
          ? Math.min(100, Math.round((item.paid / item.billed) * 1000) / 10)
          : 0;
      const shareRate =
        totalBilled > 0
          ? Math.round((item.billed / totalBilled) * 1000) / 10
          : 0;
      return {
        key,
        payerType: 'BH',
        title: item.companyName,
        subLabel: item.taxCode ? `MST: ${item.taxCode}` : undefined,
        buyerName: item.companyName,
        companyName: item.companyName,
        taxCode: item.taxCode || null,
        hasInvoice: item.hasInvoice,
        invoiceNos: Array.from(item.invoiceNos),
        hasVat: item.hasVat,
        vatAmount: item.vatAmount,
        vatWarning: item.vatWarning,
        caseCount: item.cases.length,
        billed: item.billed,
        paid: item.paid,
        remaining: item.remaining,
        rate,
        shareRate,
        cases: item.cases,
      };
    });

    const customerPartners: MonthlyReceivablesGroupItem[] = Array.from(
      custGroupMap.entries(),
    ).map(([key, item]) => {
      const rate =
        item.billed > 0
          ? Math.min(100, Math.round((item.paid / item.billed) * 1000) / 10)
          : 0;
      const shareRate =
        totalBilled > 0
          ? Math.round((item.billed / totalBilled) * 1000) / 10
          : 0;
      return {
        key,
        payerType: 'KH',
        title: item.buyerName,
        subLabel: item.taxCode ? `MST: ${item.taxCode}` : item.customerName,
        buyerName: item.buyerName,
        customerName: item.customerName,
        taxCode: item.taxCode || null,
        hasInvoice: item.hasInvoice,
        invoiceNos: Array.from(item.invoiceNos),
        hasVat: item.hasVat,
        vatAmount: item.vatAmount,
        vatWarning: item.vatWarning,
        caseCount: item.cases.length,
        billed: item.billed,
        paid: item.paid,
        remaining: item.remaining,
        rate,
        shareRate,
        cases: item.cases,
      };
    });

    const allGroups = [...insuranceCompanies, ...customerPartners].sort(
      (a, b) => b.billed - a.billed,
    );

    const collectionRate =
      totalBilled > 0
        ? Math.min(100, Math.round((totalPaid / totalBilled) * 1000) / 10)
        : 0;
    const custRate =
      custBilled > 0
        ? Math.min(100, Math.round((custPaid / custBilled) * 1000) / 10)
        : 0;
    const insRate =
      insBilled > 0
        ? Math.min(100, Math.round((insPaid / insBilled) * 1000) / 10)
        : 0;

    const totalVatWithoutInvoice = custVatNoInv + insVatNoInv;

    return {
      month: monthKey,
      monthLabel,
      summary: {
        totalBilled,
        totalPaid,
        totalRemaining,
        collectionRate,
        caseCount: cases.length,
        customer: {
          billed: custBilled,
          paid: custPaid,
          remaining: custRemaining,
          rate: custRate,
          caseCount: custCaseCount,
          withInvoiceAmount: custWithInv,
          noInvoiceAmount: custNoInv,
          vatAmount: custVatTotal,
          vatWithoutInvoiceAmount: custVatNoInv,
        },
        insurance: {
          billed: insBilled,
          paid: insPaid,
          remaining: insRemaining,
          rate: insRate,
          caseCount: insCaseCount,
          withInvoiceAmount: insWithInv,
          noInvoiceAmount: insNoInv,
          vatAmount: insVatTotal,
          vatWithoutInvoiceAmount: insVatNoInv,
        },
        warning: {
          hasVatWithoutInvoice: totalVatWithoutInvoice > 0,
          totalVatWithoutInvoice,
          casesWithVatNoInvoiceCount: warnCaseIds.size,
        },
      },
      insuranceCompanies,
      customerPartners,
      allGroups,
    };
  }
}
