import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCashflowVoucher } from '../../entities/kgara_cashflow_voucher.entity';
import { ListKgaraCashflowVoucherQueryDto } from '../../dto/garage-cashflow.dto';
import { applyMultiKeywordFilter } from '../../../common/utils/query-builder.util';

@Injectable()
export class GarageCashflowQueryEngine {
  constructor(
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
  ) {}

  async getDashboardStats() {
    const kpi = await this.voucherRepo
      .createQueryBuilder('v')
      .select(
        `SUM(CASE WHEN v.voucher_type = 'RECEIPT' THEN v.amount ELSE 0 END)`,
        'totalIn',
      )
      .addSelect(
        `SUM(CASE WHEN v.voucher_type = 'PAYMENT' THEN v.amount ELSE 0 END)`,
        'totalOut',
      )
      .getRawOne();

    const breakdownIn = await this.voucherRepo
      .createQueryBuilder('v')
      .select(
        `CASE WHEN v.erp_bank_transaction_id IS NOT NULL THEN 'Chuyển khoản' ELSE 'Tiền mặt' END`,
        'method',
      )
      .addSelect('SUM(v.amount)', 'amount')
      .where("v.voucher_type = 'RECEIPT'")
      .groupBy(
        `CASE WHEN v.erp_bank_transaction_id IS NOT NULL THEN 'Chuyển khoản' ELSE 'Tiền mặt' END`,
      )
      .getRawMany();

    const breakdownOut = await this.voucherRepo
      .createQueryBuilder('v')
      .select(
        `CASE WHEN v.erp_bank_transaction_id IS NOT NULL THEN 'Chuyển khoản' ELSE 'Tiền mặt' END`,
        'method',
      )
      .addSelect('SUM(v.amount)', 'amount')
      .where("v.voucher_type = 'PAYMENT'")
      .groupBy(
        `CASE WHEN v.erp_bank_transaction_id IS NOT NULL THEN 'Chuyển khoản' ELSE 'Tiền mặt' END`,
      )
      .getRawMany();

    const trend = await this.voucherRepo
      .createQueryBuilder('v')
      .select(`TO_CHAR(v.trans_date, 'YYYY-MM')`, 'month')
      .addSelect(
        `SUM(CASE WHEN v.voucher_type = 'RECEIPT' THEN v.amount ELSE 0 END)`,
        'in_amount',
      )
      .addSelect(
        `SUM(CASE WHEN v.voucher_type = 'PAYMENT' THEN v.amount ELSE 0 END)`,
        'out_amount',
      )
      .groupBy(`TO_CHAR(v.trans_date, 'YYYY-MM')`)
      .orderBy(`TO_CHAR(v.trans_date, 'YYYY-MM')`, 'DESC')
      .limit(6)
      .getRawMany();

    return {
      kpi: {
        totalIn: Number(kpi?.totalIn ?? kpi?.totalin ?? 0),
        totalOut: Number(kpi?.totalOut ?? kpi?.totalout ?? 0),
        net:
          Number(kpi?.totalIn ?? kpi?.totalin ?? 0) -
          Number(kpi?.totalOut ?? kpi?.totalout ?? 0),
      },
      breakdown: {
        in: breakdownIn.map((b) => ({
          method: b.method || 'Khác',
          amount: Number(b.amount),
        })),
        out: breakdownOut.map((b) => ({
          method: b.method || 'Khác',
          amount: Number(b.amount),
        })),
      },
      trend: trend
        .map((t) => ({
          month: t.month,
          in: Number(t.in_amount),
          out: Number(t.out_amount),
        }))
        .reverse(),
    };
  }

  async getColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    const qb = this.voucherRepo.createQueryBuilder('voucher');
    qb.leftJoin('voucher.case', 'case');

    let selectField = '';
    if (column === 'voucherCode') selectField = 'voucher.voucher_code';
    else if (column === 'partnerName') selectField = 'case.khachHangName';
    else if (column === 'note') selectField = 'voucher.note';
    else if (column === 'caseCode') selectField = 'case.soChungTu';
    else return { items: [], total: 0, page, pageSize, totalPages: 0 };

    qb.select(`DISTINCT ${selectField}`, 'value');
    qb.andWhere(`${selectField} IS NOT NULL`);
    qb.andWhere(`CAST(${selectField} AS TEXT) != ''`);

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0 || col === column) continue;
          if (col === 'voucherType') {
            qb.andWhere('voucher.voucher_type IN (:...vtypes)', {
              vtypes: vals,
            });
          } else if (col === 'createdAt') {
            const range = vals[0].split('..');
            if (range[0])
              qb.andWhere('voucher.created_at >= :cdFrom', {
                cdFrom: range[0],
              });
            if (range[1])
              qb.andWhere('voucher.created_at <= :cdTo', {
                cdTo: range[1] + ' 23:59:59',
              });
          } else if (col === 'caseCode') {
            qb.andWhere('case.soChungTu IN (:...vcaseCode)', {
              vcaseCode: vals,
            });
          } else if (col === 'voucherCode') {
            qb.andWhere('voucher.voucher_code IN (:...vvoucherCode)', {
              vvoucherCode: vals,
            });
          } else if (col === 'partnerName') {
            qb.andWhere('case.khachHangName IN (:...vpartnerName)', {
              vpartnerName: vals,
            });
          } else if (col === 'note') {
            qb.andWhere('voucher.note IN (:...vnote)', { vnote: vals });
          }
        }
      } catch {}
    }

    if (search) {
      applyMultiKeywordFilter(
        qb,
        `CAST(${selectField} AS TEXT)`,
        search,
        'search',
      );
    }

    qb.orderBy('value', 'ASC');

    const countQb = qb.clone();
    if (countQb.expressionMap) {
      countQb.expressionMap.groupBys = [];
      countQb.expressionMap.selects = [];
      countQb.expressionMap.orderBys = {};
    }
    const totalRaw = await countQb
      .select(`COUNT(DISTINCT ${selectField})`, 'cnt')
      .getRawOne();
    const total = parseInt(totalRaw?.cnt || '0', 10);

    qb.offset((page - 1) * pageSize).limit(pageSize);
    const results = await qb.getRawMany();

    return {
      items: results.map((r) => String(r.value)).filter(Boolean),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listVouchers(
    query: ListKgaraCashflowVoucherQueryDto,
  ): Promise<{ data: KgaraCashflowVoucher[]; total: number }> {
    const qb = this.voucherRepo.createQueryBuilder('voucher');
    qb.leftJoinAndSelect('voucher.case', 'case');
    qb.leftJoinAndSelect('voucher.erpBankTransaction', 'erpBankTransaction');

    if (query.date_from) {
      qb.andWhere('voucher.transDate >= :date_from', {
        date_from: query.date_from,
      });
    }
    if (query.date_to) {
      qb.andWhere('voucher.transDate <= :date_to', { date_to: query.date_to });
    }
    if (query.voucher_type) {
      qb.andWhere('voucher.voucherType = :voucher_type', {
        voucher_type: query.voucher_type,
      });
    }
    if (query.case_id) {
      qb.andWhere('voucher.caseId = :case_id', { case_id: query.case_id });
    }

    if (query.column_filters) {
      try {
        const filters = JSON.parse(query.column_filters);
        Object.entries(filters).forEach(([col, vals]) => {
          const arr = vals as string[];
          if (!arr || arr.length === 0) return;
          if (col === 'voucherType') {
            qb.andWhere('voucher.voucher_type IN (:...ftypes)', {
              ftypes: arr,
            });
          } else if (col === 'createdAt') {
            const range = arr[0].split('..');
            if (range[0])
              qb.andWhere('voucher.created_at >= :cFrom', { cFrom: range[0] });
            if (range[1])
              qb.andWhere('voucher.created_at <= :cTo', {
                cTo: range[1] + ' 23:59:59',
              });
          } else if (col === 'caseCode') {
            qb.andWhere('case.soChungTu IN (:...fcaseCode)', {
              fcaseCode: arr,
            });
          } else if (col === 'voucherCode') {
            qb.andWhere('voucher.voucher_code IN (:...fvoucherCode)', {
              fvoucherCode: arr,
            });
          } else if (col === 'partnerName') {
            qb.andWhere('case.khachHangName IN (:...fpartnerName)', {
              fpartnerName: arr,
            });
          } else if (col === 'note') {
            qb.andWhere('voucher.note IN (:...fnote)', { fnote: arr });
          }
        });
      } catch {}
    }

    if (query.column_search) {
      try {
        const searches = JSON.parse(query.column_search);
        Object.entries(searches).forEach(([col, val]) => {
          const searchStr = val as string;
          if (!searchStr) return;
          if (col === 'voucherCode')
            applyMultiKeywordFilter(
              qb,
              'voucher.voucher_code',
              searchStr,
              'svoucherCode',
            );
          if (col === 'partnerName')
            applyMultiKeywordFilter(
              qb,
              'case.khachHangName',
              searchStr,
              'spartnerName',
            );
          if (col === 'note')
            applyMultiKeywordFilter(qb, 'voucher.note', searchStr, 'snote');
          if (col === 'caseCode')
            applyMultiKeywordFilter(
              qb,
              'case.soChungTu',
              searchStr,
              'scaseCode',
            );
        });
      } catch {}
    }

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    if (query.sorts) {
      const sortsArr = Array.isArray(query.sorts)
        ? query.sorts
        : query.sorts.split(',');

      let hasSort = false;
      sortsArr.forEach((s) => {
        if (!s) return;
        let direction: 'ASC' | 'DESC' = 'ASC';
        let field = s;
        if (s.startsWith('-')) {
          direction = 'DESC';
          field = s.substring(1);
        }

        let dbField = '';
        if (field === 'voucherCode') dbField = 'voucher.voucherCode';
        else if (field === 'createdAt') dbField = 'voucher.createdAt';
        else if (field === 'amount') dbField = 'voucher.amount';
        else if (field === 'caseCode') dbField = 'case.soChungTu';
        else if (field === 'transDate') dbField = 'voucher.transDate';
        else if (field === 'voucherType') dbField = 'voucher.voucherType';
        else if (field === 'partnerName') dbField = 'case.khachHangName';

        if (dbField) {
          qb.addOrderBy(dbField, direction);
          hasSort = true;
        }
      });
      if (!hasSort) {
        qb.orderBy('voucher.createdAt', 'DESC');
      }
    } else {
      qb.orderBy('voucher.createdAt', 'DESC');
    }

    qb.skip(skip).take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }
}
