import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';
import { BankTransactionFilterDto } from '../dto/bank-transaction-filter.dto';
import { TransactionAccountingService } from './transaction-accounting.service';
import { applyMultiKeywordFilter } from '../../common/utils/query-builder.util';

@Injectable()
export class TransactionQueryService {
  private readonly logger = new Logger(TransactionQueryService.name);

  constructor(
    @InjectRepository(ErpBankTransaction)
    private readonly transactionRepo: Repository<ErpBankTransaction>,
    private readonly transactionAccountingService: TransactionAccountingService,
  ) {}

  async getTransaction(id: string) {
    const txn = await this.transactionRepo.findOne({
      where: { id, isDeleted: false },
      relations: [
        'branch',
        'bankAccount',
        'cashBook',
        'invoiceNetOffs',
        'invoiceNetOffs.invoice',
      ],
    });
    if (!txn) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    const [mappedTxn] = await this.loadNetOffAmounts([txn]);
    const posting =
      await this.transactionAccountingService.getTransactionPosting(id);
    return { ...mappedTxn, ...posting };
  }

  private async loadNetOffAmounts(
    transactions: ErpBankTransaction[],
  ): Promise<
    (ErpBankTransaction & { netOffAmount: string; remainingAmount: string })[]
  > {
    if (transactions.length === 0) return [];
    const ids = transactions.map((i) => i.id);
    const netOffs = await this.transactionRepo.manager
      .createQueryBuilder('erp_invoice_voucher_netoff', 'netoff')
      .select('netoff.bank_transaction_id', 'bankTransactionId')
      .addSelect('SUM(netoff.net_off_amount)', 'sum')
      .where('netoff.bank_transaction_id IN (:...ids)', { ids })
      .groupBy('netoff.bank_transaction_id')
      .getRawMany();

    const netOffMap = netOffs.reduce(
      (acc, curr) => {
        acc[curr.bankTransactionId] = Number(curr.sum) || 0;
        return acc;
      },
      {} as Record<string, number>,
    );

    return transactions.map((i) => {
      const netOff = netOffMap[i.id] || 0;
      const amount = Math.max(
        Number(i.creditAmount) || 0,
        Number(i.debitAmount) || 0,
      );
      const remaining = Math.max(0, amount - netOff);
      return {
        ...i,
        netOffAmount: String(netOff),
        remainingAmount: String(remaining),
      };
    });
  }

  async getTransactions(filter: BankTransactionFilterDto) {
    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;

    const qb = this.transactionRepo
      .createQueryBuilder('txn')
      .leftJoinAndSelect('txn.branch', 'branch')
      .leftJoinAndSelect('txn.bankAccount', 'bankAccount')
      .leftJoinAndSelect('txn.cashBook', 'cashBook')
      .leftJoinAndSelect('txn.invoiceNetOffs', 'invoiceNetOffs')
      .leftJoinAndSelect('invoiceNetOffs.invoice', 'invoice')
      .where('txn.isDeleted = :isDeleted', { isDeleted: false });

    if (filter.sourceType) {
      qb.andWhere('txn.sourceType = :sourceType', {
        sourceType: filter.sourceType,
      });
    }
    if (filter.branchId) {
      qb.andWhere('txn.branchId = :branchId', { branchId: filter.branchId });
    }
    if (filter.bankAccountId) {
      qb.andWhere('txn.bankAccountId = :bankAccountId', {
        bankAccountId: filter.bankAccountId,
      });
    }
    if (filter.cashBookId) {
      qb.andWhere('txn.cashBookId = :cashBookId', {
        cashBookId: filter.cashBookId,
      });
    }
    if (filter.startDate) {
      if (filter.startDate.length === 10) {
        qb.andWhere(
          "(txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= :startDate::date",
          { startDate: filter.startDate },
        );
      } else {
        qb.andWhere(
          "(txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') >= :startDate::timestamp",
          { startDate: filter.startDate },
        );
      }
    }
    if (filter.endDate) {
      if (filter.endDate.length === 10) {
        qb.andWhere(
          "(txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= :endDate::date",
          { endDate: filter.endDate },
        );
      } else {
        qb.andWhere(
          "(txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') <= :endDate::timestamp",
          { endDate: filter.endDate },
        );
      }
    }
    if (filter.search) {
      qb.andWhere(
        '(txn.correspondentName ILIKE :search OR txn.correspondentAccount ILIKE :search OR txn.description ILIKE :search OR txn.referenceNumber ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }
    if (filter.transactionType === 'IN') {
      qb.andWhere('txn.creditAmount > 0');
    } else if (filter.transactionType === 'OUT') {
      qb.andWhere('txn.debitAmount > 0');
    }

    if (filter.correspondentName) {
      qb.andWhere('txn.correspondentName = :correspondentName', {
        correspondentName: filter.correspondentName,
      });
    } else if (filter.correspondentAccount) {
      qb.andWhere('txn.correspondentAccount = :correspondentAccount', {
        correspondentAccount: filter.correspondentAccount,
      });
    }
    if (filter.tagIds && filter.tagIds.length > 0) {
      qb.innerJoin(
        'sys_entity_tags',
        'et',
        `et.entity_id = txn.id AND et.entity_type = 'bank_transaction'`,
      ).andWhere('et.tag_id IN (:...tagIds)', { tagIds: filter.tagIds });
    }

    const rawColumnFilters = filter.column_filters || filter.columnFilters;
    if (rawColumnFilters) {
      try {
        const cFilters = (
          typeof rawColumnFilters === 'string'
            ? JSON.parse(rawColumnFilters)
            : rawColumnFilters
        ) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(cFilters)) {
          if (!vals || vals.length === 0) continue;
          let filterField = '';
          const netOffSubquery = `COALESCE((SELECT SUM(net_off_amount) FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = txn.id), 0)`;
          const remainingAmountSubquery = `(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - ${netOffSubquery})`;

          if (col === 'netOffAmount' || col === 'remainingAmount') {
            const conditions: string[] = [];
            const amountSubquery = `GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0))`;
            if (vals.includes('settled_full'))
              conditions.push(
                `(${netOffSubquery} > 0 AND ${amountSubquery} <= ${netOffSubquery})`,
              );
            if (vals.includes('settled_partial'))
              conditions.push(
                `(${netOffSubquery} > 0 AND ${amountSubquery} > ${netOffSubquery})`,
              );
            if (vals.includes('unsettled'))
              conditions.push(`(${netOffSubquery} = 0)`);

            if (conditions.length > 0)
              qb.andWhere(`(${conditions.join(' OR ')})`);
            continue;
          }

          if (col === 'invoiceSubject') {
            const hasBlank = vals.includes('__BLANK__');
            const realVals = vals.filter((v) => v !== '__BLANK__');
            const netOffSubjectSubquery = `EXISTS (
              SELECT 1 FROM erp_invoice_voucher_netoff n
              JOIN erp_invoices i ON n.invoice_id = i.id
              WHERE n.bank_transaction_id = txn.id
              AND (
                CASE WHEN i.direction = 'IN' 
                  THEN CONCAT_WS(' - ', NULLIF(i.seller_tax_code, ''), i.seller_name)
                  ELSE CONCAT_WS(' - ', NULLIF(i.buyer_tax_code, ''), i.buyer_name)
                END IN (:...vals_${col})
                OR i.seller_name IN (:...vals_${col})
                OR i.buyer_name IN (:...vals_${col})
                OR i.seller_tax_code IN (:...vals_${col})
                OR i.buyer_tax_code IN (:...vals_${col})
              )
            )`;
            const noNetOffSubquery = `NOT EXISTS (
              SELECT 1 FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = txn.id
            )`;

            if (hasBlank && realVals.length > 0) {
              qb.andWhere(`(${netOffSubjectSubquery} OR ${noNetOffSubquery})`, {
                [`vals_${col}`]: realVals,
              });
            } else if (hasBlank) {
              qb.andWhere(noNetOffSubquery);
            } else {
              qb.andWhere(netOffSubjectSubquery, {
                [`vals_${col}`]: vals,
              });
            }
            continue;
          }

          if (col === 'account' || col === 'source') {
            if (filter.sourceType === 'BANK') filterField = 'txn.bankAccountId';
            else if (filter.sourceType === 'CASH')
              filterField = 'txn.cashBookId';
            else filterField = 'COALESCE(txn.bankAccountId, txn.cashBookId)';
          } else if (col === 'transDate')
            filterField =
              "TO_CHAR((txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'DD/MM/YYYY')";
          else if (col === 'description') filterField = 'txn.description';
          else if (col === 'thu' || col === 'creditAmount')
            filterField = 'txn.creditAmount';
          else if (col === 'chi' || col === 'debitAmount')
            filterField = 'txn.debitAmount';
          else if (col === 'balance') filterField = 'txn.balance';
          else if (
            col === 'correspondentName' ||
            col === 'partner' ||
            col === 'partnerName'
          )
            filterField =
              "COALESCE(NULLIF(txn.correspondentName, ''), NULLIF(txn.correspondentAccount, ''))";
          else if (col === 'correspondentAccount')
            filterField = 'txn.correspondentAccount';
          else if (col === 'correspondentBank')
            filterField = 'txn.correspondentBank';
          else if (col === 'branch') filterField = 'txn.branchId';
          else if (col === 'referenceNumber')
            filterField = 'txn.referenceNumber';

          if (filterField) {
            const isAllMatching = vals[0] === '__ALL_MATCHING__';
            if (isAllMatching) {
              const searchKeyword = vals[1] || '';
              if (searchKeyword.trim()) {
                if (col === 'transDate') {
                  applyMultiKeywordFilter(
                    qb,
                    filterField,
                    searchKeyword,
                    `all_match_${col}`,
                  );
                } else {
                  applyMultiKeywordFilter(
                    qb,
                    `CAST(${filterField} AS TEXT)`,
                    searchKeyword,
                    `all_match_${col}`,
                  );
                }
              }
              continue;
            }

            const hasBlank = vals.includes('__BLANK__');
            const realVals = vals.filter((v) => v !== '__BLANK__');

            if (hasBlank && realVals.length > 0) {
              if (col === 'transDate') {
                qb.andWhere(
                  `(${filterField} IN (:...vals_${col}) OR ${filterField} IS NULL OR ${filterField} = '')`,
                  { [`vals_${col}`]: realVals },
                );
              } else {
                qb.andWhere(
                  `(CAST(${filterField} AS TEXT) IN (:...vals_${col}) OR ${filterField} IS NULL OR CAST(${filterField} AS TEXT) = '')`,
                  { [`vals_${col}`]: realVals },
                );
              }
            } else if (hasBlank) {
              if (col === 'transDate') {
                qb.andWhere(`(${filterField} IS NULL OR ${filterField} = '')`);
              } else {
                qb.andWhere(
                  `(${filterField} IS NULL OR CAST(${filterField} AS TEXT) = '')`,
                );
              }
            } else {
              if (col === 'transDate') {
                qb.andWhere(`${filterField} IN (:...vals_${col})`, {
                  [`vals_${col}`]: vals,
                });
              } else {
                qb.andWhere(
                  `CAST(${filterField} AS TEXT) IN (:...vals_${col})`,
                  {
                    [`vals_${col}`]: vals,
                  },
                );
              }
            }
          }
        }
      } catch (e) {}
    }

    const rawColumnSearch = filter.column_search || filter.columnSearch;
    if (rawColumnSearch) {
      try {
        const cSearch = (
          typeof rawColumnSearch === 'string'
            ? JSON.parse(rawColumnSearch)
            : rawColumnSearch
        ) as Record<string, string>;

        const netOffSubquery = `COALESCE((SELECT SUM(net_off_amount) FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = txn.id), 0)`;
        const remainingAmountSubquery = `(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - ${netOffSubquery})`;

        for (const [col, val] of Object.entries(cSearch)) {
          if (!val) continue;

          if (col === 'invoiceSubject') {
            const keywords = val
              .split(';')
              .map((k) => k.trim())
              .filter((k) => k.length > 0);

            if (keywords.length > 0) {
              qb.andWhere(
                new Brackets((sqb) => {
                  keywords.forEach((kw, idx) => {
                    let isExact = false;
                    let cleanKw = kw;
                    if (
                      kw.startsWith('"') &&
                      kw.endsWith('"') &&
                      kw.length >= 2
                    ) {
                      isExact = true;
                      cleanKw = kw.slice(1, -1);
                    }
                    const paramName = `subjSearch_${idx}`;
                    const paramVal = isExact ? cleanKw : `%${cleanKw}%`;
                    const op = isExact ? '=' : 'ILIKE';
                    const cond = `EXISTS (
                      SELECT 1 FROM erp_invoice_voucher_netoff n
                      JOIN erp_invoices i ON n.invoice_id = i.id
                      WHERE n.bank_transaction_id = txn.id
                      AND (
                        i.seller_name ${op} :${paramName}
                        OR i.buyer_name ${op} :${paramName}
                        OR i.seller_tax_code ${op} :${paramName}
                        OR i.buyer_tax_code ${op} :${paramName}
                        OR CONCAT_WS(' - ', NULLIF(i.seller_tax_code, ''), i.seller_name) ${op} :${paramName}
                        OR CONCAT_WS(' - ', NULLIF(i.buyer_tax_code, ''), i.buyer_name) ${op} :${paramName}
                      )
                    )`;
                    if (idx === 0) {
                      sqb.where(cond, { [paramName]: paramVal });
                    } else {
                      sqb.orWhere(cond, { [paramName]: paramVal });
                    }
                  });
                }),
              );
            }
            continue;
          }

          let searchField = '';
          if (col === 'account' || col === 'source') {
            if (filter.sourceType === 'BANK')
              searchField = 'bankAccount.bankName';
            else if (filter.sourceType === 'CASH')
              searchField = 'cashBook.name';
            else searchField = 'COALESCE(bankAccount.bankName, cashBook.name)';
          } else if (col === 'transDate')
            searchField = "TO_CHAR(txn.transDate, 'DD/MM/YYYY')";
          else if (col === 'description') searchField = 'txn.description';
          else if (col === 'thu' || col === 'creditAmount')
            searchField = 'txn.creditAmount';
          else if (col === 'chi' || col === 'debitAmount')
            searchField = 'txn.debitAmount';
          else if (col === 'balance') searchField = 'txn.balance';
          else if (col === 'netOffAmount') searchField = netOffSubquery;
          else if (col === 'remainingAmount')
            searchField = remainingAmountSubquery;
          else if (
            col === 'correspondentName' ||
            col === 'partner' ||
            col === 'partnerName'
          )
            searchField =
              "COALESCE(NULLIF(txn.correspondentName, ''), NULLIF(txn.correspondentAccount, ''))";
          else if (col === 'correspondentAccount')
            searchField = 'txn.correspondentAccount';
          else if (col === 'correspondentBank')
            searchField = 'txn.correspondentBank';
          else if (col === 'branch') searchField = 'branch.name';
          else if (col === 'referenceNumber')
            searchField = 'txn.referenceNumber';

          if (searchField) {
            if (col === 'transDate') {
              applyMultiKeywordFilter(
                qb,
                "TO_CHAR(txn.transDate, 'DD/MM/YYYY')",
                val,
                `search_${col}`,
              );
            } else if (
              [
                'thu',
                'creditAmount',
                'chi',
                'debitAmount',
                'balance',
                'netOffAmount',
                'remainingAmount',
              ].includes(col)
            ) {
              const cleanVal = val.replace(/[,.]/g, '');
              applyMultiKeywordFilter(
                qb,
                `REPLACE(REPLACE(CAST(${searchField} AS TEXT), '.', ''), ',', '')`,
                cleanVal,
                `search_${col}`,
              );
            } else {
              applyMultiKeywordFilter(
                qb,
                `CAST(${searchField} AS TEXT)`,
                val,
                `search_${col}`,
              );
            }
          }
        }
      } catch (e) {}
    }

    const sortList: string[] = [];
    if (filter.sorts && filter.sorts.length > 0) {
      if (Array.isArray(filter.sorts)) {
        sortList.push(...filter.sorts);
      } else if (typeof filter.sorts === 'string') {
        try {
          const parsed = JSON.parse(filter.sorts);
          if (Array.isArray(parsed)) sortList.push(...parsed);
          else sortList.push(filter.sorts);
        } catch {
          sortList.push(filter.sorts);
        }
      }
    } else if (filter.sortBy) {
      const orderPrefix = filter.sortOrder?.toUpperCase() === 'DESC' ? '-' : '';
      sortList.push(`${orderPrefix}${filter.sortBy}`);
    }

    let hasOrder = false;
    for (const sortField of sortList) {
      if (!sortField || typeof sortField !== 'string') continue;
      const isDesc = sortField.startsWith('-');
      const rawField = isDesc ? sortField.substring(1) : sortField;
      const order = isDesc ? 'DESC' : 'ASC';

      let orderExpr = '';
      if (
        rawField === 'transDate' ||
        rawField === 'trans_date' ||
        rawField === 'date'
      ) {
        orderExpr = 'txn.transDate';
      } else if (
        rawField === 'account' ||
        rawField === 'bankAccount' ||
        rawField === 'cashBook'
      ) {
        orderExpr =
          filter.sourceType === 'BANK'
            ? 'bankAccount.bankName'
            : filter.sourceType === 'CASH'
              ? 'cashBook.name'
              : 'COALESCE(bankAccount.bankName, cashBook.name)';
      } else if (
        rawField === 'referenceNumber' ||
        rawField === 'reference_number' ||
        rawField === 'refNum'
      ) {
        orderExpr = 'txn.referenceNumber';
      } else if (rawField === 'description') {
        orderExpr = 'txn.description';
      } else if (
        rawField === 'thu' ||
        rawField === 'creditAmount' ||
        rawField === 'credit_amount'
      ) {
        orderExpr = 'txn.creditAmount';
      } else if (
        rawField === 'chi' ||
        rawField === 'debitAmount' ||
        rawField === 'debit_amount'
      ) {
        orderExpr = 'txn.debitAmount';
      } else if (rawField === 'amount') {
        orderExpr =
          '(COALESCE(txn.creditAmount, 0) - COALESCE(txn.debitAmount, 0))';
      } else if (rawField === 'balance') {
        orderExpr = 'txn.balance';
      } else if (rawField === 'netOffAmount' || rawField === 'net_off_amount') {
        orderExpr =
          'COALESCE((SELECT SUM(n.net_off_amount) FROM erp_invoice_voucher_netoff n WHERE n.bank_transaction_id = txn.id), 0)';
      } else if (
        rawField === 'remainingAmount' ||
        rawField === 'remaining_amount'
      ) {
        orderExpr =
          '(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - COALESCE((SELECT SUM(n.net_off_amount) FROM erp_invoice_voucher_netoff n WHERE n.bank_transaction_id = txn.id), 0))';
      } else if (
        rawField === 'correspondentName' ||
        rawField === 'partner' ||
        rawField === 'partnerName' ||
        rawField === 'corrName'
      ) {
        orderExpr =
          "COALESCE(NULLIF(txn.correspondentName, ''), NULLIF(txn.correspondentAccount, ''))";
      } else if (
        rawField === 'correspondentAccount' ||
        rawField === 'corrAccount'
      ) {
        orderExpr = 'txn.correspondentAccount';
      } else if (rawField === 'correspondentBank' || rawField === 'corrBank') {
        orderExpr = 'txn.correspondentBank';
      } else if (rawField === 'branch' || rawField === 'branchId') {
        orderExpr = 'branch.name';
      } else if (rawField === 'createdAt' || rawField === 'created_at') {
        orderExpr = 'txn.createdAt';
      }

      if (orderExpr) {
        if (!hasOrder) {
          qb.orderBy(orderExpr, order);
          hasOrder = true;
        } else {
          qb.addOrderBy(orderExpr, order);
        }
      }
    }

    if (!hasOrder) {
      qb.orderBy('txn.transDate', 'DESC').addOrderBy('txn.createdAt', 'DESC');
    } else {
      qb.addOrderBy('txn.createdAt', 'DESC');
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    const mappedItems = await this.loadNetOffAmounts(items);
    const totalPages = Math.ceil(total / pageSize);

    // Calculate Grand Totals and Cumulative Totals
    let grandTotalCredit = 0;
    let grandTotalDebit = 0;
    let grandTotalNetOff = 0;
    let grandTotalRemaining = 0;
    let cumulativeCredit = 0;
    let cumulativeDebit = 0;
    let cumulativeNetOff = 0;
    let cumulativeRemaining = 0;

    try {
      const netOffSubquery = `COALESCE((SELECT SUM(n.net_off_amount) FROM erp_invoice_voucher_netoff n WHERE n.bank_transaction_id = txn.id), 0)`;
      const remainingSubquery = `GREATEST(0, GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - ${netOffSubquery})`;

      const totalsQb = qb.clone();
      if (totalsQb.expressionMap) {
        totalsQb.expressionMap.orderBys = {};
        totalsQb.expressionMap.selects = [];
      }
      totalsQb.offset?.(undefined);
      totalsQb.limit?.(undefined);
      totalsQb.skip?.(undefined);
      totalsQb.take?.(undefined);
      totalsQb
        .select('COALESCE(SUM(txn.creditAmount), 0)', 'totalCredit')
        .addSelect('COALESCE(SUM(txn.debitAmount), 0)', 'totalDebit')
        .addSelect(`COALESCE(SUM(${netOffSubquery}), 0)`, 'totalNetOff')
        .addSelect(`COALESCE(SUM(${remainingSubquery}), 0)`, 'totalRemaining');
      const totalsRaw = await totalsQb.getRawOne();
      grandTotalCredit = parseFloat(totalsRaw?.totalCredit || '0') || 0;
      grandTotalDebit = parseFloat(totalsRaw?.totalDebit || '0') || 0;
      grandTotalNetOff = parseFloat(totalsRaw?.totalNetOff || '0') || 0;
      grandTotalRemaining = parseFloat(totalsRaw?.totalRemaining || '0') || 0;

      if (page === 1) {
        cumulativeCredit = mappedItems.reduce(
          (acc, curr) => acc + (Number(curr.creditAmount) || 0),
          0,
        );
        cumulativeDebit = mappedItems.reduce(
          (acc, curr) => acc + (Number(curr.debitAmount) || 0),
          0,
        );
        cumulativeNetOff = mappedItems.reduce(
          (acc, curr) => acc + (Number(curr.netOffAmount) || 0),
          0,
        );
        cumulativeRemaining = mappedItems.reduce(
          (acc, curr) => acc + (Number(curr.remainingAmount) || 0),
          0,
        );
      } else if (page >= totalPages && totalPages > 0) {
        cumulativeCredit = grandTotalCredit;
        cumulativeDebit = grandTotalDebit;
        cumulativeNetOff = grandTotalNetOff;
        cumulativeRemaining = grandTotalRemaining;
      } else {
        const cumQb = qb.clone();
        if (cumQb.expressionMap) {
          cumQb.expressionMap.selects = [];
        }
        cumQb
          .select('txn.creditAmount', 'credit')
          .addSelect('txn.debitAmount', 'debit')
          .addSelect(netOffSubquery, 'netOff')
          .addSelect(remainingSubquery, 'remaining')
          .offset(0)
          .limit(page * pageSize);
        cumQb.skip?.(undefined);
        cumQb.take?.(undefined);

        const cumRows = await cumQb.getRawMany();
        cumulativeCredit = cumRows.reduce(
          (acc, curr) =>
            acc +
            (parseFloat(String(curr.credit ?? curr.txn_credit_amount ?? 0)) ||
              0),
          0,
        );
        cumulativeDebit = cumRows.reduce(
          (acc, curr) =>
            acc +
            (parseFloat(String(curr.debit ?? curr.txn_debit_amount ?? 0)) || 0),
          0,
        );
        cumulativeNetOff = cumRows.reduce(
          (acc, curr) =>
            acc + (parseFloat(String(curr.netOff ?? curr.netoff ?? 0)) || 0),
          0,
        );
        cumulativeRemaining = cumRows.reduce(
          (acc, curr) => acc + (parseFloat(String(curr.remaining ?? 0)) || 0),
          0,
        );
      }
    } catch (e) {
      this.logger.error(`Error calculating totals in getTransactions: ${e}`);
    }

    return {
      items: mappedItems,
      total,
      page,
      pageSize,
      totalPages,
      totals: {
        grandTotalCredit,
        grandTotalDebit,
        grandTotalNetOff,
        grandTotalRemaining,
        cumulativeCredit,
        cumulativeDebit,
        cumulativeNetOff,
        cumulativeRemaining,
      },
    };
  }

  async getColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    sourceType?: 'BANK' | 'CASH',
  ) {
    const qb = this.transactionRepo.createQueryBuilder('txn');

    if (sourceType) {
      qb.where('txn.sourceType = :sourceType', { sourceType });
    } else {
      qb.where('1 = 1');
    }

    let selectField = '';
    let labelField = '';

    if (column === 'account' || column === 'source') {
      if (sourceType === 'BANK') {
        qb.leftJoin('txn.bankAccount', 'bankAccount');
        selectField = 'txn.bankAccountId';
        labelField = `COALESCE(bankAccount.bankName, '') || ' - ' || COALESCE(bankAccount.accountNumber, '')`;
      } else if (sourceType === 'CASH') {
        qb.leftJoin('txn.cashBook', 'cashBook');
        selectField = 'txn.cashBookId';
        labelField = 'cashBook.name';
      } else {
        qb.leftJoin('txn.bankAccount', 'bankAccount');
        qb.leftJoin('txn.cashBook', 'cashBook');
        selectField = 'COALESCE(txn.bankAccountId, txn.cashBookId)';
        labelField = `COALESCE(bankAccount.bankName || ' - ' || bankAccount.accountNumber, cashBook.name)`;
      }
    } else if (column === 'transDate')
      selectField =
        "TO_CHAR((txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'DD/MM/YYYY')";
    else if (column === 'description') selectField = 'txn.description';
    else if (column === 'thu' || column === 'creditAmount')
      selectField = 'txn.creditAmount';
    else if (column === 'chi' || column === 'debitAmount')
      selectField = 'txn.debitAmount';
    else if (column === 'netOffAmount')
      selectField = `COALESCE((SELECT SUM(net_off_amount) FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = txn.id), 0)`;
    else if (column === 'remainingAmount')
      selectField = `(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - COALESCE((SELECT SUM(net_off_amount) FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = txn.id), 0))`;
    else if (column === 'balance') selectField = 'txn.balance';
    else if (
      column === 'correspondentName' ||
      column === 'partner' ||
      column === 'partnerName'
    )
      selectField =
        "COALESCE(NULLIF(txn.correspondentName, ''), NULLIF(txn.correspondentAccount, ''))";
    else if (column === 'correspondentAccount')
      selectField = 'txn.correspondentAccount';
    else if (column === 'correspondentBank')
      selectField = 'txn.correspondentBank';
    else if (column === 'branch') {
      qb.leftJoin('txn.branch', 'branch');
      selectField = 'txn.branchId';
      labelField = 'branch.name';
    } else if (column === 'referenceNumber')
      selectField = 'txn.referenceNumber';
    else if (column === 'invoiceSubject') {
      qb.innerJoin('txn.invoiceNetOffs', 'netoff');
      qb.innerJoin('netoff.invoice', 'inv');
      selectField = `CASE WHEN inv.direction = 'IN' THEN CONCAT_WS(' - ', NULLIF(inv.seller_tax_code, ''), inv.seller_name) ELSE CONCAT_WS(' - ', NULLIF(inv.buyer_tax_code, ''), inv.buyer_name) END`;
      labelField = selectField;
    } else return { items: [], total: 0, page, pageSize, totalPages: 0 };

    if (!labelField) labelField = selectField;

    qb.select(`DISTINCT ${selectField}`, 'value');
    qb.addSelect(`MAX(${labelField})`, 'label');
    qb.andWhere(`${selectField} IS NOT NULL`);
    if (column !== 'transDate') {
      qb.andWhere(`CAST(${selectField} AS TEXT) != ''`);
    } else {
      qb.andWhere(`${selectField} != ''`);
    }
    qb.groupBy(selectField);

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;

          let filterField = '';
          const netOffSubquery = `COALESCE((SELECT SUM(net_off_amount) FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = txn.id), 0)`;
          const remainingAmountSubquery = `(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - ${netOffSubquery})`;

          if (col === 'account' || col === 'source') {
            if (sourceType === 'BANK') filterField = 'txn.bankAccountId';
            else if (sourceType === 'CASH') filterField = 'txn.cashBookId';
            else filterField = 'COALESCE(txn.bankAccountId, txn.cashBookId)';
          } else if (col === 'transDate')
            filterField =
              "TO_CHAR((txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'DD/MM/YYYY')";
          else if (col === 'description') filterField = 'txn.description';
          else if (col === 'thu' || col === 'creditAmount')
            filterField = 'txn.creditAmount';
          else if (col === 'chi' || col === 'debitAmount')
            filterField = 'txn.debitAmount';
          else if (col === 'netOffAmount') filterField = netOffSubquery;
          else if (col === 'remainingAmount')
            filterField = remainingAmountSubquery;
          else if (col === 'balance') filterField = 'txn.balance';
          else if (
            col === 'correspondentName' ||
            col === 'partner' ||
            col === 'partnerName'
          )
            filterField =
              "COALESCE(NULLIF(txn.correspondentName, ''), NULLIF(txn.correspondentAccount, ''))";
          else if (col === 'correspondentAccount')
            filterField = 'txn.correspondentAccount';
          else if (col === 'correspondentBank')
            filterField = 'txn.correspondentBank';
          else if (col === 'branch') filterField = 'txn.branchId';
          else if (col === 'referenceNumber')
            filterField = 'txn.referenceNumber';

          if (filterField) {
            const isAllMatching = vals[0] === '__ALL_MATCHING__';
            if (isAllMatching) {
              const searchKeyword = vals[1] || '';
              if (searchKeyword.trim()) {
                if (col === 'transDate') {
                  applyMultiKeywordFilter(
                    qb,
                    filterField,
                    searchKeyword,
                    `all_match_opts_${col}`,
                  );
                } else {
                  applyMultiKeywordFilter(
                    qb,
                    `CAST(${filterField} AS TEXT)`,
                    searchKeyword,
                    `all_match_opts_${col}`,
                  );
                }
              }
              continue;
            }

            const hasBlank = vals.includes('__BLANK__');
            const realVals = vals.filter((v) => v !== '__BLANK__');

            if (hasBlank && realVals.length > 0) {
              if (col === 'transDate') {
                qb.andWhere(
                  `(${filterField} IN (:...vals_${col}) OR ${filterField} IS NULL OR ${filterField} = '')`,
                  { [`vals_${col}`]: realVals },
                );
              } else {
                qb.andWhere(
                  `(CAST(${filterField} AS TEXT) IN (:...vals_${col}) OR ${filterField} IS NULL OR CAST(${filterField} AS TEXT) = '')`,
                  { [`vals_${col}`]: realVals },
                );
              }
            } else if (hasBlank) {
              if (col === 'transDate') {
                qb.andWhere(`(${filterField} IS NULL OR ${filterField} = '')`);
              } else {
                qb.andWhere(
                  `(${filterField} IS NULL OR CAST(${filterField} AS TEXT) = '')`,
                );
              }
            } else {
              if (col === 'transDate') {
                qb.andWhere(`${filterField} IN (:...vals_${col})`, {
                  [`vals_${col}`]: vals,
                });
              } else {
                qb.andWhere(
                  `CAST(${filterField} AS TEXT) IN (:...vals_${col})`,
                  {
                    [`vals_${col}`]: vals,
                  },
                );
              }
            }
          }
        }
      } catch (e) {}
    }

    if (search) {
      applyMultiKeywordFilter(
        qb,
        column === 'transDate' ? labelField : `CAST(${labelField} AS TEXT)`,
        search,
        'col_search',
      );
    }

    qb.orderBy('value', 'ASC');

    const countQb = qb.clone();
    countQb.expressionMap.groupBys = [];
    const totalRaw = await countQb
      .orderBy()
      .select(`COUNT(DISTINCT ${selectField})`, 'cnt')
      .getRawOne();
    const total = parseInt(totalRaw?.cnt || '0', 10);

    qb.offset((page - 1) * pageSize).limit(pageSize);
    const results = await qb.getRawMany();

    return {
      items: results
        .map((r) => ({
          value: String(r.value),
          label: r.label ? String(r.label) : String(r.value),
        }))
        .filter((r) => r.value),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
