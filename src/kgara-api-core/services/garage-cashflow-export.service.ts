import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';
import { GarageCashflowExportDto } from '../dto/garage-cashflow-export.dto';
import { GarageCashflowExcelBuilder } from './garage-cashflow-excel.builder';
import { applyMultiKeywordFilter } from '../../common/utils/query-builder.util';
import type { ExportProgressReporter } from '../../common/export-jobs/export-job-runner';

@Injectable()
export class GarageCashflowExportService {
  private readonly logger = new Logger(GarageCashflowExportService.name);

  constructor(
    @InjectRepository(KgaraCashflowVoucher)
    private readonly voucherRepo: Repository<KgaraCashflowVoucher>,
    private readonly excelBuilder: GarageCashflowExcelBuilder,
  ) {}

  async buildExcel(
    dto: GarageCashflowExportDto,
    onProgress: ExportProgressReporter,
  ): Promise<Buffer> {
    onProgress(10, 100, 'Đang chuẩn bị điều kiện xuất dữ liệu...');

    const qb = this.voucherRepo.createQueryBuilder('voucher');
    qb.leftJoinAndSelect('voucher.case', 'case');
    qb.leftJoinAndSelect('voucher.erpBankTransaction', 'bankTx');

    this.applyFilters(qb, dto);

    onProgress(25, 100, 'Đang truy vấn dữ liệu từ cơ sở dữ liệu...');
    const vouchers = await qb.getMany();

    onProgress(
      50,
      100,
      `Đã tìm thấy ${vouchers.length} phiếu thu chi. Đang tạo file Excel...`,
    );

    const buffer = await this.excelBuilder.build({
      vouchers,
      selectedColumns: dto.selectedColumns,
      onProgress: (percent, msg) => {
        // Map 50..100%
        const mapped = Math.round(50 + (percent / 100) * 48);
        onProgress(mapped, 100, msg);
      },
    });

    onProgress(100, 100, 'Xuất file Excel thành công.');
    return buffer;
  }

  private applyFilters(
    qb: SelectQueryBuilder<KgaraCashflowVoucher>,
    dto: GarageCashflowExportDto,
  ): void {
    const isByPeriod =
      dto.mode === 'by-period' ||
      (!dto.mode &&
        (dto.periodType ||
          dto.period ||
          dto.quarter ||
          dto.dateFrom ||
          dto.startDate));

    if (isByPeriod) {
      let from = dto.dateFrom || dto.startDate;
      let to = dto.dateTo || dto.endDate;

      if (dto.periodType === 'week' && dto.week) {
        if (dto.week.includes('_')) {
          const [wFrom, wTo] = dto.week.split('_');
          if (wFrom) from = wFrom;
          if (wTo) to = wTo;
        }
      } else if (dto.periodType === 'month' && dto.period) {
        // YYYY-MM
        const [y, m] = dto.period.split('-').map(Number);
        if (y && m) {
          const firstDay = new Date(Date.UTC(y, m - 1, 1));
          const lastDay = new Date(Date.UTC(y, m, 0));
          from = firstDay.toISOString().slice(0, 10);
          to = lastDay.toISOString().slice(0, 10);
        }
      } else if (dto.periodType === 'quarter' && dto.quarter) {
        // YYYY-Q1 .. YYYY-Q4
        const [yStr, qStr] = dto.quarter.split('-Q');
        const y = Number(yStr);
        const q = Number(qStr);
        if (y && q >= 1 && q <= 4) {
          const startMonth = (q - 1) * 3;
          const endMonth = startMonth + 2;
          const firstDay = new Date(Date.UTC(y, startMonth, 1));
          const lastDay = new Date(Date.UTC(y, endMonth + 1, 0));
          from = firstDay.toISOString().slice(0, 10);
          to = lastDay.toISOString().slice(0, 10);
        }
      }

      if (from) {
        qb.andWhere('voucher.trans_date >= :expFrom', { expFrom: from });
      }
      if (to) {
        qb.andWhere('voucher.trans_date <= :expTo', { expTo: to });
      }

      if (dto.voucherType && dto.voucherType !== 'ALL') {
        qb.andWhere('voucher.voucher_type = :expVType', {
          expVType: dto.voucherType,
        });
      }

      if (dto.paymentMethod) {
        qb.andWhere('voucher.payment_method = :expPMethod', {
          expPMethod: dto.paymentMethod,
        });
      }

      if (dto.paymentStatus) {
        qb.andWhere('voucher.payment_status = :expPStatus', {
          expPStatus: dto.paymentStatus,
        });
      }

      if (dto.accountId) {
        qb.andWhere('bankTx.bank_account_id = :expBankAccountId', {
          expBankAccountId: dto.accountId,
        });
      }
    }

    // Apply table-wide search
    const searchVal = dto.q || dto.search;
    if (searchVal) {
      applyMultiKeywordFilter(
        qb,
        `CONCAT_WS(' ', voucher.voucher_code, voucher.partner_name, voucher.license_plate, voucher.payment_content, voucher.note, case.so_chung_tu, case.bien_so_xe, case.khach_hang_name)`,
        searchVal,
        'expSearch',
      );
    }

    // Apply column filters (used in current-filter mode)
    if (dto.column_filters) {
      try {
        const filters = JSON.parse(dto.column_filters);
        Object.entries(filters).forEach(([col, vals]) => {
          const arr = vals as string[];
          if (!arr || arr.length === 0) return;

          if (col === 'voucherType') {
            qb.andWhere('voucher.voucher_type IN (:...cfTypes)', {
              cfTypes: arr,
            });
          } else if (col === 'transDate') {
            const range = arr[0].split('..');
            if (range[0])
              qb.andWhere('voucher.trans_date >= :cftFrom', {
                cftFrom: range[0],
              });
            if (range[1])
              qb.andWhere('voucher.trans_date <= :cftTo', { cftTo: range[1] });
          } else if (col === 'createdAt') {
            const range = arr[0].split('..');
            if (range[0])
              qb.andWhere('voucher.created_at >= :cfcFrom', {
                cfcFrom: range[0],
              });
            if (range[1])
              qb.andWhere('voucher.created_at <= :cfcTo', {
                cfcTo: range[1] + ' 23:59:59',
              });
          } else if (col === 'thu') {
            qb.andWhere("voucher.voucher_type = 'RECEIPT'");
            if (arr[0]?.includes('..')) {
              const [f, t] = arr[0].split('..');
              if (f)
                qb.andWhere('voucher.amount >= :cfthuFrom', {
                  cfthuFrom: Number(f),
                });
              if (t)
                qb.andWhere('voucher.amount <= :cfthuTo', {
                  cfthuTo: Number(t),
                });
            } else {
              qb.andWhere('voucher.amount IN (:...cfthu)', {
                cfthu: arr.map(Number),
              });
            }
          } else if (col === 'chi') {
            qb.andWhere("voucher.voucher_type = 'PAYMENT'");
            if (arr[0]?.includes('..')) {
              const [f, t] = arr[0].split('..');
              if (f)
                qb.andWhere('voucher.amount >= :cfchiFrom', {
                  cfchiFrom: Number(f),
                });
              if (t)
                qb.andWhere('voucher.amount <= :cfchiTo', {
                  cfchiTo: Number(t),
                });
            } else {
              qb.andWhere('voucher.amount IN (:...cfchi)', {
                cfchi: arr.map(Number),
              });
            }
          } else if (col === 'caseCode') {
            const hasBlank = arr.includes('__BLANK__');
            const nonBlank = arr.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "(case.so_chung_tu IN (:...cfcase) OR case.so_chung_tu IS NULL OR case.so_chung_tu = '')",
                { cfcase: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere(
                "(case.so_chung_tu IS NULL OR case.so_chung_tu = '')",
              );
            } else {
              qb.andWhere('case.so_chung_tu IN (:...cfcase)', { cfcase: arr });
            }
          } else if (col === 'voucherCode') {
            qb.andWhere('voucher.voucher_code IN (:...cfvCode)', {
              cfvCode: arr,
            });
          } else if (col === 'licensePlate') {
            const hasBlank = arr.includes('__BLANK__');
            const nonBlank = arr.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "((voucher.license_plate IN (:...cfplate) OR case.bien_so_xe IN (:...cfplate)) OR (COALESCE(voucher.license_plate, case.bien_so_xe) IS NULL OR COALESCE(voucher.license_plate, case.bien_so_xe) = ''))",
                { cfplate: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere(
                "(COALESCE(voucher.license_plate, case.bien_so_xe) IS NULL OR COALESCE(voucher.license_plate, case.bien_so_xe) = '')",
              );
            } else {
              qb.andWhere(
                '(voucher.license_plate IN (:...cfplate) OR case.bien_so_xe IN (:...cfplate))',
                { cfplate: arr },
              );
            }
          } else if (col === 'paymentMethod') {
            qb.andWhere('voucher.payment_method IN (:...cfpMethod)', {
              cfpMethod: arr,
            });
          } else if (col === 'paymentContent') {
            qb.andWhere('voucher.payment_content IN (:...cfpContent)', {
              cfpContent: arr,
            });
          } else if (col === 'paymentStatus') {
            qb.andWhere('voucher.payment_status IN (:...cfpStatus)', {
              cfpStatus: arr,
            });
          } else if (col === 'partnerName') {
            qb.andWhere(
              '(voucher.partner_name IN (:...cfpName) OR case.khach_hang_name IN (:...cfpName))',
              { cfpName: arr },
            );
          } else if (col === 'note') {
            qb.andWhere('voucher.note IN (:...cfNote)', { cfNote: arr });
          }
        });
      } catch (err) {
        this.logger.warn(`Failed to parse column_filters in export: ${err}`);
      }
    }

    // Apply column search
    if (dto.column_search) {
      try {
        const searches = JSON.parse(dto.column_search) as Record<
          string,
          unknown
        >;
        Object.entries(searches).forEach(([col, val]) => {
          if (val === undefined || val === null || val === '') return;
          const str =
            typeof val === 'string'
              ? val
              : typeof val === 'number' || typeof val === 'boolean'
                ? String(val)
                : '';
          if (!str) return;
          if (col === 'voucherCode') {
            applyMultiKeywordFilter(qb, 'voucher.voucher_code', str, 'sc_vc');
          } else if (col === 'partnerName') {
            applyMultiKeywordFilter(
              qb,
              'COALESCE(voucher.partner_name, case.khach_hang_name)',
              str,
              'sc_pn',
            );
          } else if (col === 'licensePlate') {
            applyMultiKeywordFilter(
              qb,
              'COALESCE(voucher.license_plate, case.bien_so_xe)',
              str,
              'sc_lp',
            );
          } else if (col === 'caseCode') {
            applyMultiKeywordFilter(qb, 'case.so_chung_tu', str, 'sc_cc');
          } else if (col === 'paymentContent') {
            applyMultiKeywordFilter(
              qb,
              'voucher.payment_content',
              str,
              'sc_pc',
            );
          } else if (col === 'note') {
            applyMultiKeywordFilter(qb, 'voucher.note', str, 'sc_nt');
          }
        });
      } catch (err) {
        this.logger.warn(`Failed to parse column_search in export: ${err}`);
      }
    }

    // Apply sorts
    if (dto.sorts && dto.sorts.length > 0) {
      dto.sorts.forEach((sortItem, idx) => {
        const isDesc = sortItem.startsWith('-');
        const col = isDesc ? sortItem.slice(1) : sortItem;
        const dir = isDesc ? 'DESC' : 'ASC';
        let sortCol = 'voucher.trans_date';
        if (col === 'transDate') sortCol = 'voucher.trans_date';
        else if (col === 'voucherCode') sortCol = 'voucher.voucher_code';
        else if (col === 'thu' || col === 'chi') sortCol = 'voucher.amount';
        else if (col === 'paymentStatus') sortCol = 'voucher.payment_status';
        else if (col === 'createdAt') sortCol = 'voucher.created_at';
        else if (col === 'licensePlate')
          sortCol = 'COALESCE(voucher.license_plate, case.bien_so_xe)';
        else if (col === 'partnerName')
          sortCol = 'COALESCE(voucher.partner_name, case.khach_hang_name)';

        if (idx === 0) {
          qb.orderBy(sortCol, dir);
        } else {
          qb.addOrderBy(sortCol, dir);
        }
      });
    } else {
      qb.orderBy('voucher.trans_date', 'DESC');
      qb.addOrderBy('voucher.created_at', 'DESC');
    }
  }
}
