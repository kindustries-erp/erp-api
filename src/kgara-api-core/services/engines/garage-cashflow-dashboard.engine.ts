import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { KgaraCashflowVoucher } from '../../entities/kgara_cashflow_voucher.entity';
import { KgaraBranch } from '../../entities/kgara_branch.entity';
import {
  GarageCashflowDashboardQueryDto,
  GarageCashflowDashboardResponseDto,
  GarageCashflowKpiDto,
  GarageCashflowMethodBreakdownDto,
  GarageCashflowContentBreakdownDto,
  GarageCashflowTrendItemDto,
  GarageCashflowTopTransactionsDto,
} from '../../dto/garage-cashflow.dto';

@Injectable()
export class GarageCashflowDashboardEngine {
  constructor(
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
  ) {}

  private applyBaseFilters(
    qb: SelectQueryBuilder<KgaraCashflowVoucher>,
    query: GarageCashflowDashboardQueryDto,
    hasCaseJoin: boolean = false,
  ): void {
    if (query.dateFrom) {
      qb.andWhere('v.trans_date >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('v.trans_date <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.paymentMethod && query.paymentMethod !== 'ALL') {
      qb.andWhere('v.payment_method = :paymentMethod', {
        paymentMethod: query.paymentMethod,
      });
    }
    if (query.paymentContent && query.paymentContent !== 'ALL') {
      qb.andWhere('v.payment_content = :paymentContent', {
        paymentContent: query.paymentContent,
      });
    }
    if (
      query.branchId &&
      query.branchId.trim() !== '' &&
      query.branchId !== 'ALL'
    ) {
      const branchId = query.branchId.trim();
      if (!hasCaseJoin) {
        qb.leftJoin('v.case', 'c');
      }
      qb.leftJoin(KgaraBranch, 'b', 'b.external_id = c.branch_external_id');
      qb.andWhere(
        '(c.branch_external_id = :branchId OR CAST(b.id AS TEXT) = :branchId OR b.name = :branchId OR b.code = :branchId)',
        {
          branchId,
        },
      );
    }
  }

  async getDashboardStats(
    query: GarageCashflowDashboardQueryDto = {},
  ): Promise<GarageCashflowDashboardResponseDto> {
    const [kpi, methodBreakdown, contentBreakdown, trend, topTransactions] =
      await Promise.all([
        this.getKpis(query),
        this.getMethodBreakdown(query),
        this.getContentBreakdown(query),
        this.getTrend(query),
        this.getTopTransactions(query),
      ]);

    return {
      kpi,
      methodBreakdown,
      contentBreakdown,
      trend,
      topTransactions,
    };
  }

  private async getKpis(
    query: GarageCashflowDashboardQueryDto,
  ): Promise<GarageCashflowKpiDto> {
    const qb = this.voucherRepo.createQueryBuilder('v');
    this.applyBaseFilters(qb, query);

    qb.select(
      `SUM(CASE WHEN v.voucher_type = 'RECEIPT' AND (v.payment_status IS NULL OR v.payment_status != 'EXPECTED') THEN v.amount ELSE 0 END)`,
      'totalIn',
    )
      .addSelect(
        `SUM(CASE WHEN v.voucher_type = 'PAYMENT' THEN v.amount ELSE 0 END)`,
        'totalOut',
      )
      .addSelect(
        `COUNT(CASE WHEN v.voucher_type = 'RECEIPT' AND (v.payment_status IS NULL OR v.payment_status != 'EXPECTED') THEN 1 END)`,
        'countIn',
      )
      .addSelect(
        `COUNT(CASE WHEN v.voucher_type = 'PAYMENT' THEN 1 END)`,
        'countOut',
      )
      .addSelect(
        `SUM(CASE WHEN v.voucher_type = 'PAYMENT' AND v.payment_status = 'PENDING' THEN v.amount ELSE 0 END)`,
        'pendingOutAmount',
      )
      .addSelect(
        `COUNT(CASE WHEN v.voucher_type = 'PAYMENT' AND v.payment_status = 'PENDING' THEN 1 END)`,
        'pendingOutCount',
      )
      .addSelect(
        `SUM(CASE WHEN v.voucher_type = 'RECEIPT' AND v.payment_status = 'EXPECTED' THEN v.amount ELSE 0 END)`,
        'pendingInAmount',
      )
      .addSelect(
        `COUNT(CASE WHEN v.voucher_type = 'RECEIPT' AND v.payment_status = 'EXPECTED' THEN 1 END)`,
        'pendingInCount',
      );

    const raw = await qb.getRawOne();
    const totalIn = Number(raw?.totalIn ?? raw?.totalin ?? 0);
    const totalOut = Number(raw?.totalOut ?? raw?.totalout ?? 0);

    return {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      countIn: Number(raw?.countIn ?? raw?.countin ?? 0),
      countOut: Number(raw?.countOut ?? raw?.countout ?? 0),
      pendingOutAmount: Number(
        raw?.pendingOutAmount ?? raw?.pendingoutamount ?? 0,
      ),
      pendingOutCount: Number(
        raw?.pendingOutCount ?? raw?.pendingoutcount ?? 0,
      ),
      pendingInAmount: Number(
        raw?.pendingInAmount ?? raw?.pendinginamount ?? 0,
      ),
      pendingInCount: Number(raw?.pendingInCount ?? raw?.pendingincount ?? 0),
    };
  }

  private async getMethodBreakdown(
    query: GarageCashflowDashboardQueryDto,
  ): Promise<GarageCashflowMethodBreakdownDto> {
    const fetchBreakdown = async (type: 'RECEIPT' | 'PAYMENT') => {
      const qb = this.voucherRepo.createQueryBuilder('v');
      this.applyBaseFilters(qb, query);
      qb.select(`COALESCE(NULLIF(v.payment_method, ''), 'Khác')`, 'name')
        .addSelect('SUM(v.amount)', 'amount')
        .addSelect('COUNT(1)', 'count')
        .andWhere('v.voucher_type = :type', { type })
        .groupBy(`COALESCE(NULLIF(v.payment_method, ''), 'Khác')`)
        .orderBy('SUM(v.amount)', 'DESC');

      const raw = await qb.getRawMany();
      return raw.map((r) => ({
        name: String(r.name ?? 'Khác'),
        amount: Number(r.amount ?? 0),
        count: Number(r.count ?? 0),
      }));
    };

    const [inMethods, outMethods] = await Promise.all([
      fetchBreakdown('RECEIPT'),
      fetchBreakdown('PAYMENT'),
    ]);
    return { in: inMethods, out: outMethods };
  }

  private async getContentBreakdown(
    query: GarageCashflowDashboardQueryDto,
  ): Promise<GarageCashflowContentBreakdownDto> {
    const fetchContent = async (type: 'RECEIPT' | 'PAYMENT') => {
      const qb = this.voucherRepo.createQueryBuilder('v');
      this.applyBaseFilters(qb, query);
      qb.select(`COALESCE(NULLIF(v.payment_content, ''), 'Khác')`, 'name')
        .addSelect('SUM(v.amount)', 'amount')
        .addSelect('COUNT(1)', 'count')
        .andWhere('v.voucher_type = :type', { type })
        .groupBy(`COALESCE(NULLIF(v.payment_content, ''), 'Khác')`)
        .orderBy('SUM(v.amount)', 'DESC');

      const raw = await qb.getRawMany();
      return raw.map((r) => ({
        name: String(r.name ?? 'Khác'),
        amount: Number(r.amount ?? 0),
        count: Number(r.count ?? 0),
      }));
    };

    const [inContent, outContent] = await Promise.all([
      fetchContent('RECEIPT'),
      fetchContent('PAYMENT'),
    ]);
    return { in: inContent, out: outContent };
  }

  private async getTrend(
    query: GarageCashflowDashboardQueryDto,
  ): Promise<GarageCashflowTrendItemDto[]> {
    const qb = this.voucherRepo.createQueryBuilder('v');
    this.applyBaseFilters(qb, query);
    qb.select(`TO_CHAR(v.trans_date, 'YYYY-MM')`, 'label')
      .addSelect(
        `SUM(CASE WHEN v.voucher_type = 'RECEIPT' THEN v.amount ELSE 0 END)`,
        'cashIn',
      )
      .addSelect(
        `SUM(CASE WHEN v.voucher_type = 'PAYMENT' THEN v.amount ELSE 0 END)`,
        'cashOut',
      )
      .groupBy(`TO_CHAR(v.trans_date, 'YYYY-MM')`)
      .orderBy(`TO_CHAR(v.trans_date, 'YYYY-MM')`, 'DESC')
      .limit(6);

    const raw = await qb.getRawMany();
    return raw
      .map((r) => {
        const inAmt = Number(r.cashIn ?? r.cashin ?? 0);
        const outAmt = Number(r.cashOut ?? r.cashout ?? 0);
        return {
          label: String(r.label ?? ''),
          cashIn: inAmt,
          cashOut: outAmt,
          net: inAmt - outAmt,
        };
      })
      .reverse();
  }

  private async getTopTransactions(
    query: GarageCashflowDashboardQueryDto,
  ): Promise<GarageCashflowTopTransactionsDto> {
    const fetchTop = async (type: 'RECEIPT' | 'PAYMENT') => {
      const qb = this.voucherRepo.createQueryBuilder('v');
      qb.leftJoin('v.case', 'c');
      this.applyBaseFilters(qb, query, true);
      qb.select([
        'v.id AS id',
        'v.voucher_code AS "voucherCode"',
        'v.trans_date AS "transDate"',
        'v.amount AS amount',
        'v.partner_name AS "partnerName"',
        'v.license_plate AS "licensePlate"',
        'v.payment_method AS "paymentMethod"',
        'v.payment_content AS "paymentContent"',
        'v.payment_status AS "paymentStatus"',
        'c.so_chung_tu AS "caseCode"',
        'v.case_id AS "caseId"',
      ])
        .andWhere('v.voucher_type = :type', { type })
        .orderBy('v.amount', 'DESC')
        .limit(5);

      const raw = await qb.getRawMany();
      return raw.map((r) => ({
        id: String(r.id),
        voucherCode: String(r.voucherCode ?? ''),
        transDate: r.transDate ? String(r.transDate).substring(0, 10) : '',
        amount: Number(r.amount ?? 0),
        partnerName: r.partnerName ?? null,
        licensePlate: r.licensePlate ?? null,
        paymentMethod: r.paymentMethod ?? null,
        paymentContent: r.paymentContent ?? null,
        paymentStatus: r.paymentStatus ?? null,
        caseCode: r.caseCode ?? null,
        caseId: r.caseId ?? null,
      }));
    };

    const [topIn, topOut] = await Promise.all([
      fetchTop('RECEIPT'),
      fetchTop('PAYMENT'),
    ]);
    return { in: topIn, out: topOut };
  }
}
