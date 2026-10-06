import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';

@Injectable()
export class InvoiceStatsService {
  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repository: Repository<ErpInvoice>,
  ) {}

  async getBulkNetOffs(invoiceIds: string[]) {
    if (!invoiceIds || invoiceIds.length === 0) return [];

    return this.repository.manager
      .createQueryBuilder('erp_invoice_voucher_netoff', 'netoff')
      .leftJoinAndSelect('netoff.bankTransaction', 'txn')
      .where('netoff.invoice_id IN (:...invoiceIds)', { invoiceIds })
      .getMany();
  }

  async getStats(direction?: 'IN' | 'OUT', dateFrom?: string, dateTo?: string) {
    const today = new Date();

    // Compute sixMonthsAgo as YYYY-MM-DD string
    let smYear = today.getFullYear();
    let smMonth = today.getMonth() - 5;
    if (smMonth < 0) {
      smMonth += 12;
      smYear -= 1;
    }
    const sixMonthsAgoStr = `${smYear}-${String(smMonth + 1).padStart(2, '0')}-01`;

    const qb = this.repository.createQueryBuilder('inv');
    qb.where('inv.is_deleted = false');
    if (direction) {
      qb.andWhere('inv.direction = :direction', { direction });
    }
    qb.andWhere(
      '(inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)',
    );
    // Use string comparison for exact match based on database Date
    let fetchFrom = sixMonthsAgoStr;
    if (dateFrom && dateFrom < fetchFrom) {
      fetchFrom = dateFrom;
    }
    qb.andWhere(`TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') >= :fetchFrom`, {
      fetchFrom,
    });

    qb.leftJoin('erp_branches', 'b', 'b.id = inv.branch_id');
    qb.select(`TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')`, 'day_date');
    qb.addSelect(`inv.branch_id`, 'branch_id');
    qb.addSelect(`b.name`, 'branch_name');
    qb.addSelect(`SUM(inv.total_amount)`, 'total_amount');
    qb.addSelect(`SUM(inv.pre_vat_amount)`, 'pre_vat_amount');
    qb.groupBy(`TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')`);
    qb.addGroupBy(`inv.branch_id`);
    qb.addGroupBy(`b.name`);
    qb.orderBy(`TO_CHAR(inv.invoice_date, 'YYYY-MM-DD')`, 'ASC');

    const records = await qb.getRawMany();

    let monthTotal = 0,
      monthPreVat = 0;
    let weekTotal = 0,
      weekPreVat = 0;
    let dayTotal = 0,
      dayPreVat = 0;

    const monthChart = Array(6).fill(0);
    const weekChart = Array(4).fill(0);
    const dayChart = Array(7).fill(0);

    const monthPreVatChart = Array(6).fill(0);
    const weekPreVatChart = Array(4).fill(0);
    const dayPreVatChart = Array(7).fill(0);

    const byBranchMap = new Map<string, any>();
    const getBranchKey = (name: string | null) => {
      if (name?.toLowerCase().includes('đào trí')) return 'dao_tri';
      if (name?.toLowerCase().includes('phổ quang')) return 'pho_quang';
      return 'other';
    };
    const getBranchLabel = (key: string) => {
      if (key === 'dao_tri') return 'Đào Trí';
      if (key === 'pho_quang') return 'Phổ Quang';
      return 'Còn lại';
    };
    const getBranchStats = (key: string) => {
      if (!byBranchMap.has(key)) {
        byBranchMap.set(key, {
          branchName: getBranchLabel(key),
          monthTotal: 0,
          monthPreVat: 0,
          weekTotal: 0,
          weekPreVat: 0,
          dayTotal: 0,
          dayPreVat: 0,
        });
      }
      return byBranchMap.get(key)!;
    };

    // Helpers to get start of current periods as YYYY-MM-DD strings
    const pad = (n: number) => String(n).padStart(2, '0');

    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(
      today.getDate(),
    )}`;

    const thisMonthStr = `${today.getFullYear()}-${pad(
      today.getMonth() + 1,
    )}-01`;

    const startOfThisWeek = new Date(today);
    startOfThisWeek.setDate(
      today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1),
    ); // Monday
    const thisWeekStr = `${startOfThisWeek.getFullYear()}-${pad(
      startOfThisWeek.getMonth() + 1,
    )}-${pad(startOfThisWeek.getDate())}`;

    // Helper to calculate diff in days between two YYYY-MM-DD strings
    const diffDays = (d1Str: string, d2Str: string) => {
      // Create local mid-day dates to avoid DST/timezone issues when computing diffs
      const [y1, m1, d1] = d1Str.split('-').map(Number);
      const [y2, m2, d2] = d2Str.split('-').map(Number);
      const date1 = new Date(y1, m1 - 1, d1, 12, 0, 0);
      const date2 = new Date(y2, m2 - 1, d2, 12, 0, 0);
      return Math.round(
        (date1.getTime() - date2.getTime()) / (1000 * 3600 * 24),
      );
    };

    for (const row of records) {
      const dStr = row.day_date; // string like '2026-06-01'
      const total = Number(row.total_amount) || 0;
      const prevat = Number(row.pre_vat_amount) || 0;
      const branchKey = getBranchKey(row.branch_name);
      const bStats = getBranchStats(branchKey);

      // If dateFrom and dateTo are provided, use them for totals instead of current periods
      if (dateFrom && dateTo) {
        if (dStr >= dateFrom && dStr <= dateTo) {
          monthTotal += total;
          monthPreVat += prevat;
          bStats.monthTotal += total;
          bStats.monthPreVat += prevat;

          weekTotal += total;
          weekPreVat += prevat;
          bStats.weekTotal += total;
          bStats.weekPreVat += prevat;

          dayTotal += total;
          dayPreVat += prevat;
          bStats.dayTotal += total;
          bStats.dayPreVat += prevat;
        }
      } else {
        // Current Day
        if (dStr === todayStr) {
          dayTotal += total;
          dayPreVat += prevat;
          bStats.dayTotal += total;
          bStats.dayPreVat += prevat;
        }

        // Current Week
        if (dStr >= thisWeekStr) {
          weekTotal += total;
          weekPreVat += prevat;
          bStats.weekTotal += total;
          bStats.weekPreVat += prevat;
        }

        // Current Month
        if (dStr >= thisMonthStr) {
          monthTotal += total;
          monthPreVat += prevat;
          bStats.monthTotal += total;
          bStats.monthPreVat += prevat;
        }
      }

      // Day Chart (last 7 days, index 6 is today, 0 is 6 days ago)
      const dDays = diffDays(todayStr, dStr);
      if (dDays >= 0 && dDays < 7) {
        dayChart[6 - dDays] += total;
        dayPreVatChart[6 - dDays] += prevat;
      }

      // Week Chart (last 4 weeks, index 3 is this week, 0 is 3 weeks ago)
      let weekIndex = 3;
      if (dStr < thisWeekStr) {
        const dWeeks = Math.ceil(diffDays(thisWeekStr, dStr) / 7);
        weekIndex = 3 - dWeeks;
      }
      if (weekIndex >= 0 && weekIndex < 4) {
        weekChart[weekIndex] += total;
        weekPreVatChart[weekIndex] += prevat;
      }

      // Month Chart (last 6 months, index 5 is this month, 0 is 5 months ago)
      let monthIndex = 5;
      if (dStr < thisMonthStr) {
        // compute diff in months
        const [y1, m1] = thisMonthStr.split('-').map(Number);
        const [y2, m2] = dStr.split('-').map(Number);
        const dMonths = (y1 - y2) * 12 + (m1 - m2);
        monthIndex = 5 - dMonths;
      }
      if (monthIndex >= 0 && monthIndex < 6) {
        monthChart[monthIndex] += total;
        monthPreVatChart[monthIndex] += prevat;
      }
    }

    const byBranch = Array.from(byBranchMap.values());
    byBranch.sort((a: any, b: any) => {
      const order: Record<string, number> = {
        'Đào Trí': 1,
        'Phổ Quang': 2,
        'Còn lại': 3,
      };
      return (order[a.branchName] || 99) - (order[b.branchName] || 99);
    });

    return {
      monthTotal,
      monthPreVat,
      monthChart,
      monthPreVatChart,
      weekTotal,
      weekPreVat,
      weekChart,
      weekPreVatChart,
      dayTotal,
      dayPreVat,
      dayChart,
      dayPreVatChart,
      byBranch,
    };
  }
}
