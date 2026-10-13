import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCashflowVoucher } from '../../entities/kgara_cashflow_voucher.entity';
import {
  ListKgaraCashflowVoucherQueryDto,
  KgaraCashflowVoucherResponseDto,
  toKgaraCashflowVoucherResponse,
} from '../../dto/garage-cashflow.dto';
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
    else if (column === 'partnerName')
      selectField = 'COALESCE(voucher.partner_name, case.khach_hang_name)';
    else if (column === 'licensePlate')
      selectField = 'COALESCE(voucher.license_plate, case.bien_so_xe)';
    else if (column === 'paymentMethod') selectField = 'voucher.payment_method';
    else if (column === 'paymentContent')
      selectField = 'voucher.payment_content';
    else if (column === 'note') selectField = 'voucher.note';
    else if (column === 'caseCode') selectField = 'case.so_chung_tu';
    else if (column === 'transDate') selectField = 'voucher.trans_date';
    else if (column === 'thu') {
      selectField = 'voucher.amount';
      qb.andWhere("voucher.voucher_type = 'RECEIPT'");
    } else if (column === 'chi') {
      selectField = 'voucher.amount';
      qb.andWhere("voucher.voucher_type = 'PAYMENT'");
    } else return { items: [], total: 0, page, pageSize, totalPages: 0 };

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
          } else if (col === 'transDate') {
            const range = vals[0].split('..');
            if (range[0])
              qb.andWhere('voucher.trans_date >= :vtdFrom', {
                vtdFrom: range[0],
              });
            if (range[1])
              qb.andWhere('voucher.trans_date <= :vtdTo', {
                vtdTo: range[1],
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
          } else if (col === 'thu') {
            qb.andWhere("voucher.voucher_type = 'RECEIPT'");
            if (vals[0]?.includes('..')) {
              const [f, t] = vals[0].split('..');
              if (f)
                qb.andWhere('voucher.amount >= :vthuFrom', {
                  vthuFrom: Number(f),
                });
              if (t)
                qb.andWhere('voucher.amount <= :vthuTo', {
                  vthuTo: Number(t),
                });
            } else {
              qb.andWhere('voucher.amount IN (:...vthu)', {
                vthu: vals.map(Number),
              });
            }
          } else if (col === 'chi') {
            qb.andWhere("voucher.voucher_type = 'PAYMENT'");
            if (vals[0]?.includes('..')) {
              const [f, t] = vals[0].split('..');
              if (f)
                qb.andWhere('voucher.amount >= :vchiFrom', {
                  vchiFrom: Number(f),
                });
              if (t)
                qb.andWhere('voucher.amount <= :vchiTo', {
                  vchiTo: Number(t),
                });
            } else {
              qb.andWhere('voucher.amount IN (:...vchi)', {
                vchi: vals.map(Number),
              });
            }
          } else if (col === 'caseCode') {
            const hasBlank = vals.includes('__BLANK__');
            const nonBlank = vals.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "(case.soChungTu IN (:...vcaseCode) OR case.soChungTu IS NULL OR case.soChungTu = '')",
                { vcaseCode: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere("(case.soChungTu IS NULL OR case.soChungTu = '')");
            } else {
              qb.andWhere('case.soChungTu IN (:...vcaseCode)', {
                vcaseCode: vals,
              });
            }
          } else if (col === 'voucherCode') {
            qb.andWhere('voucher.voucher_code IN (:...vvoucherCode)', {
              vvoucherCode: vals,
            });
          } else if (col === 'partnerName') {
            const hasBlank = vals.includes('__BLANK__');
            const nonBlank = vals.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "((voucher.partner_name IN (:...vpartnerName) OR case.khach_hang_name IN (:...vpartnerName)) OR (COALESCE(voucher.partner_name, case.khach_hang_name) IS NULL OR COALESCE(voucher.partner_name, case.khach_hang_name) = ''))",
                { vpartnerName: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere(
                "(COALESCE(voucher.partner_name, case.khach_hang_name) IS NULL OR COALESCE(voucher.partner_name, case.khach_hang_name) = '')",
              );
            } else {
              qb.andWhere(
                '(voucher.partner_name IN (:...vpartnerName) OR case.khach_hang_name IN (:...vpartnerName))',
                {
                  vpartnerName: vals,
                },
              );
            }
          } else if (col === 'licensePlate') {
            const hasBlank = vals.includes('__BLANK__');
            const nonBlank = vals.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "((voucher.license_plate IN (:...vlicensePlate) OR case.bien_so_xe IN (:...vlicensePlate)) OR (COALESCE(voucher.license_plate, case.bien_so_xe) IS NULL OR COALESCE(voucher.license_plate, case.bien_so_xe) = ''))",
                { vlicensePlate: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere(
                "(COALESCE(voucher.license_plate, case.bien_so_xe) IS NULL OR COALESCE(voucher.license_plate, case.bien_so_xe) = '')",
              );
            } else {
              qb.andWhere(
                '(voucher.license_plate IN (:...vlicensePlate) OR case.bien_so_xe IN (:...vlicensePlate))',
                {
                  vlicensePlate: vals,
                },
              );
            }
          } else if (col === 'paymentMethod') {
            qb.andWhere('voucher.payment_method IN (:...vpaymentMethod)', {
              vpaymentMethod: vals,
            });
          } else if (col === 'paymentContent') {
            const hasBlank = vals.includes('__BLANK__');
            const nonBlank = vals.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "(voucher.payment_content IN (:...vpaymentContent) OR voucher.payment_content IS NULL OR voucher.payment_content = '')",
                { vpaymentContent: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere(
                "(voucher.payment_content IS NULL OR voucher.payment_content = '')",
              );
            } else {
              qb.andWhere('voucher.payment_content IN (:...vpaymentContent)', {
                vpaymentContent: vals,
              });
            }
          } else if (col === 'note') {
            const hasBlank = vals.includes('__BLANK__');
            const nonBlank = vals.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "(voucher.note IN (:...vnote) OR voucher.note IS NULL OR voucher.note = '')",
                { vnote: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere("(voucher.note IS NULL OR voucher.note = '')");
            } else {
              qb.andWhere('voucher.note IN (:...vnote)', { vnote: vals });
            }
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
  ): Promise<{ data: KgaraCashflowVoucherResponseDto[]; total: number }> {
    const qb = this.voucherRepo.createQueryBuilder('voucher');
    qb.leftJoin('voucher.case', 'case');
    qb.addSelect([
      'case.id',
      'case.soChungTu',
      'case.bienSoXe',
      'case.khachHangName',
      'case.khachHangCode',
    ]);
    qb.leftJoin('voucher.erpBankTransaction', 'erpBankTransaction');
    qb.addSelect([
      'erpBankTransaction.id',
      'erpBankTransaction.referenceNumber',
      'erpBankTransaction.seqNo',
    ]);

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
          } else if (col === 'transDate') {
            const range = arr[0].split('..');
            if (range[0])
              qb.andWhere('voucher.trans_date >= :tFrom', { tFrom: range[0] });
            if (range[1])
              qb.andWhere('voucher.trans_date <= :tTo', { tTo: range[1] });
          } else if (col === 'createdAt') {
            const range = arr[0].split('..');
            if (range[0])
              qb.andWhere('voucher.created_at >= :cFrom', { cFrom: range[0] });
            if (range[1])
              qb.andWhere('voucher.created_at <= :cTo', {
                cTo: range[1] + ' 23:59:59',
              });
          } else if (col === 'thu') {
            qb.andWhere("voucher.voucher_type = 'RECEIPT'");
            if (arr[0]?.includes('..')) {
              const [f, t] = arr[0].split('..');
              if (f)
                qb.andWhere('voucher.amount >= :fthuFrom', {
                  fthuFrom: Number(f),
                });
              if (t)
                qb.andWhere('voucher.amount <= :fthuTo', {
                  fthuTo: Number(t),
                });
            } else {
              qb.andWhere('voucher.amount IN (:...fthu)', {
                fthu: arr.map(Number),
              });
            }
          } else if (col === 'chi') {
            qb.andWhere("voucher.voucher_type = 'PAYMENT'");
            if (arr[0]?.includes('..')) {
              const [f, t] = arr[0].split('..');
              if (f)
                qb.andWhere('voucher.amount >= :fchiFrom', {
                  fchiFrom: Number(f),
                });
              if (t)
                qb.andWhere('voucher.amount <= :fchiTo', {
                  fchiTo: Number(t),
                });
            } else {
              qb.andWhere('voucher.amount IN (:...fchi)', {
                fchi: arr.map(Number),
              });
            }
          } else if (col === 'caseCode') {
            const hasBlank = arr.includes('__BLANK__');
            const nonBlank = arr.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "(case.so_chung_tu IN (:...fcaseCode) OR case.so_chung_tu IS NULL OR case.so_chung_tu = '')",
                { fcaseCode: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere(
                "(case.so_chung_tu IS NULL OR case.so_chung_tu = '')",
              );
            } else {
              qb.andWhere('case.so_chung_tu IN (:...fcaseCode)', {
                fcaseCode: arr,
              });
            }
          } else if (col === 'voucherCode') {
            qb.andWhere('voucher.voucher_code IN (:...fvoucherCode)', {
              fvoucherCode: arr,
            });
          } else if (col === 'partnerName') {
            const hasBlank = arr.includes('__BLANK__');
            const nonBlank = arr.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "((voucher.partner_name IN (:...fpartnerName) OR case.khach_hang_name IN (:...fpartnerName)) OR (COALESCE(voucher.partner_name, case.khach_hang_name) IS NULL OR COALESCE(voucher.partner_name, case.khach_hang_name) = ''))",
                { fpartnerName: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere(
                "(COALESCE(voucher.partner_name, case.khach_hang_name) IS NULL OR COALESCE(voucher.partner_name, case.khach_hang_name) = '')",
              );
            } else {
              qb.andWhere(
                '(voucher.partner_name IN (:...fpartnerName) OR case.khach_hang_name IN (:...fpartnerName))',
                {
                  fpartnerName: arr,
                },
              );
            }
          } else if (col === 'licensePlate') {
            const hasBlank = arr.includes('__BLANK__');
            const nonBlank = arr.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "((voucher.license_plate IN (:...flicensePlate) OR case.bien_so_xe IN (:...flicensePlate)) OR (COALESCE(voucher.license_plate, case.bien_so_xe) IS NULL OR COALESCE(voucher.license_plate, case.bien_so_xe) = ''))",
                { flicensePlate: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere(
                "(COALESCE(voucher.license_plate, case.bien_so_xe) IS NULL OR COALESCE(voucher.license_plate, case.bien_so_xe) = '')",
              );
            } else {
              qb.andWhere(
                '(voucher.license_plate IN (:...flicensePlate) OR case.bien_so_xe IN (:...flicensePlate))',
                {
                  flicensePlate: arr,
                },
              );
            }
          } else if (col === 'paymentMethod') {
            qb.andWhere('voucher.payment_method IN (:...fpaymentMethod)', {
              fpaymentMethod: arr,
            });
          } else if (col === 'paymentContent') {
            const hasBlank = arr.includes('__BLANK__');
            const nonBlank = arr.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "(voucher.payment_content IN (:...fpaymentContent) OR voucher.payment_content IS NULL OR voucher.payment_content = '')",
                { fpaymentContent: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere(
                "(voucher.payment_content IS NULL OR voucher.payment_content = '')",
              );
            } else {
              qb.andWhere('voucher.payment_content IN (:...fpaymentContent)', {
                fpaymentContent: arr,
              });
            }
          } else if (col === 'note') {
            const hasBlank = arr.includes('__BLANK__');
            const nonBlank = arr.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "(voucher.note IN (:...fnote) OR voucher.note IS NULL OR voucher.note = '')",
                { fnote: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere("(voucher.note IS NULL OR voucher.note = '')");
            } else {
              qb.andWhere('voucher.note IN (:...fnote)', { fnote: arr });
            }
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
              'COALESCE(voucher.partner_name, case.khach_hang_name)',
              searchStr,
              'spartnerName',
            );
          if (col === 'licensePlate')
            applyMultiKeywordFilter(
              qb,
              'COALESCE(voucher.license_plate, case.bien_so_xe)',
              searchStr,
              'slicensePlate',
            );
          if (col === 'paymentMethod')
            applyMultiKeywordFilter(
              qb,
              'voucher.payment_method',
              searchStr,
              'spaymentMethod',
            );
          if (col === 'paymentContent')
            applyMultiKeywordFilter(
              qb,
              'voucher.payment_content',
              searchStr,
              'spaymentContent',
            );
          if (col === 'note')
            applyMultiKeywordFilter(qb, 'voucher.note', searchStr, 'snote');
          if (col === 'caseCode')
            applyMultiKeywordFilter(
              qb,
              'case.so_chung_tu',
              searchStr,
              'scaseCode',
            );
        });
      } catch {}
    }

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const rawSorts = query.sorts || query['sorts[]'];

    if (rawSorts) {
      const sortsArr = Array.isArray(rawSorts)
        ? rawSorts
        : typeof rawSorts === 'string'
          ? rawSorts.split(',')
          : [];

      let hasSort = false;
      sortsArr.forEach((s) => {
        if (!s || typeof s !== 'string') return;
        const trimmed = s.trim();
        if (!trimmed) return;
        let direction: 'ASC' | 'DESC' = 'ASC';
        let field = trimmed;
        if (trimmed.startsWith('-')) {
          direction = 'DESC';
          field = trimmed.substring(1);
        }

        let dbField = '';
        if (field === 'voucherCode') dbField = 'voucher.voucherCode';
        else if (field === 'createdAt') dbField = 'voucher.createdAt';
        else if (field === 'amount') dbField = 'voucher.amount';
        else if (field === 'caseCode') dbField = 'case.soChungTu';
        else if (field === 'transDate') dbField = 'voucher.transDate';
        else if (field === 'voucherType') dbField = 'voucher.voucherType';
        else if (field === 'partnerName') dbField = 'voucher.partnerName';
        else if (field === 'licensePlate') dbField = 'voucher.licensePlate';
        else if (field === 'paymentMethod') dbField = 'voucher.paymentMethod';
        else if (field === 'paymentContent') dbField = 'voucher.paymentContent';

        if (dbField) {
          qb.addOrderBy(dbField, direction);
          hasSort = true;
        }
      });
      if (!hasSort) {
        qb.orderBy('voucher.transDate', 'DESC')
          .addOrderBy('voucher.createdAt', 'DESC')
          .addOrderBy('voucher.voucherCode', 'DESC');
      } else {
        qb.addOrderBy('voucher.createdAt', 'DESC').addOrderBy(
          'voucher.voucherCode',
          'DESC',
        );
      }
    } else {
      qb.orderBy('voucher.transDate', 'DESC')
        .addOrderBy('voucher.createdAt', 'DESC')
        .addOrderBy('voucher.voucherCode', 'DESC');
    }

    qb.skip(skip).take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map(toKgaraCashflowVoucherResponse),
      total,
    };
  }
}
