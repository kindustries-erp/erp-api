import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';
import { BankTransactionFilterDto } from '../dto/bank-transaction-filter.dto';

@Injectable()
export class TransactionAnalyticsService {
  constructor(
    @InjectRepository(ErpBankTransaction)
    private readonly transactionRepo: Repository<ErpBankTransaction>,
  ) {}

  async getPartnerStats(filter: BankTransactionFilterDto) {
    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;

    const qb = this.transactionRepo
      .createQueryBuilder('txn')
      .where('txn.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        "(NULLIF(txn.correspondentName, '') IS NOT NULL OR NULLIF(txn.correspondentAccount, '') IS NOT NULL)",
      );

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
    if (filter.sourceType) {
      qb.andWhere('txn.sourceType = :sourceType', {
        sourceType: filter.sourceType,
      });
    }
    if (filter.branchId) {
      qb.andWhere('txn.branchId = :branchId', { branchId: filter.branchId });
    }
    if (filter.tagIds && filter.tagIds.length > 0) {
      qb.innerJoin(
        'sys_entity_tags',
        'et',
        `et.entity_id = txn.id AND et.entity_type = 'bank_transaction'`,
      ).andWhere('et.tag_id IN (:...tagIds)', { tagIds: filter.tagIds });
    }

    const groupField =
      "COALESCE(NULLIF(txn.correspondentName, ''), NULLIF(txn.correspondentAccount, ''), 'Khác')";

    if (filter.column_filters) {
      try {
        const cFilters = JSON.parse(filter.column_filters) as Record<
          string,
          string[]
        >;
        for (const [col, vals] of Object.entries(cFilters)) {
          if (!vals || vals.length === 0) continue;
          if (col === 'correspondentAccount') {
            qb.andWhere(`txn.correspondentAccount IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          } else if (col === 'correspondentName') {
            qb.andWhere(`txn.correspondentName IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          } else if (col === 'partner') {
            qb.andWhere(
              `COALESCE(NULLIF(txn.correspondentName, ''), NULLIF(txn.correspondentAccount, ''), 'Khác') IN (:...vals_${col})`,
              {
                [`vals_${col}`]: vals,
              },
            );
          } else if (col === 'totalCredit') {
            qb.andHaving(
              `SUM(COALESCE(txn.creditAmount, 0)) IN (:...vals_${col})`,
              {
                [`vals_${col}`]: vals,
              },
            );
          } else if (col === 'totalDebit') {
            qb.andHaving(
              `SUM(COALESCE(txn.debitAmount, 0)) IN (:...vals_${col})`,
              {
                [`vals_${col}`]: vals,
              },
            );
          } else if (col === 'transactionCount') {
            qb.andHaving(`COUNT(txn.id) IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          }
        }
      } catch (e) {}
    }

    if (filter.column_search) {
      try {
        const cSearch = JSON.parse(filter.column_search) as Record<
          string,
          string
        >;
        for (const [col, val] of Object.entries(cSearch)) {
          if (!val) continue;
          if (col === 'correspondentAccount') {
            qb.andWhere(`txn.correspondentAccount ILIKE :search_${col}`, {
              [`search_${col}`]: `%${val}%`,
            });
          } else if (col === 'correspondentName') {
            qb.andWhere(`txn.correspondentName ILIKE :search_${col}`, {
              [`search_${col}`]: `%${val}%`,
            });
          } else if (col === 'partner') {
            qb.andWhere(
              `(
              txn.correspondentAccount ILIKE :search_${col} OR
              txn.correspondentName ILIKE :search_${col}
            )`,
              {
                [`search_${col}`]: `%${val}%`,
              },
            );
          } else if (col === 'invoiceSubject') {
            qb.andWhere(
              `EXISTS (
              SELECT 1 FROM erp_invoice_voucher_netoff n
              JOIN erp_invoices i ON n.invoice_id = i.id
              WHERE n.bank_transaction_id = txn.id
              AND (i.seller_name ILIKE :search_${col} OR i.buyer_name ILIKE :search_${col} OR i.seller_tax_code ILIKE :search_${col} OR i.buyer_tax_code ILIKE :search_${col})
            )`,
              {
                [`search_${col}`]: `%${val}%`,
              },
            );
          } else if (col === 'totalCredit') {
            qb.andHaving(
              `CAST(SUM(COALESCE(txn.creditAmount, 0)) AS TEXT) ILIKE :search_${col}`,
              {
                [`search_${col}`]: `%${val}%`,
              },
            );
          } else if (col === 'totalDebit') {
            qb.andHaving(
              `CAST(SUM(COALESCE(txn.debitAmount, 0)) AS TEXT) ILIKE :search_${col}`,
              {
                [`search_${col}`]: `%${val}%`,
              },
            );
          } else if (col === 'transactionCount') {
            qb.andHaving(`CAST(COUNT(txn.id) AS TEXT) ILIKE :search_${col}`, {
              [`search_${col}`]: `%${val}%`,
            });
          }
        }
      } catch (e) {}
    }

    qb.select(groupField, 'groupId')
      .addSelect('MAX(txn.correspondentAccount)', 'correspondentAccount')
      .addSelect('MAX(txn.correspondentName)', 'correspondentName')
      .addSelect('SUM(COALESCE(txn.creditAmount, 0))', 'totalCredit')
      .addSelect('SUM(COALESCE(txn.debitAmount, 0))', 'totalDebit')
      .addSelect('COUNT(txn.id)', 'transactionCount')
      .groupBy(groupField);

    const countQb = qb.clone();
    countQb.orderBy();
    const [sql, params] = countQb.getQueryAndParameters();
    const totalRaw = await this.transactionRepo.manager.query(
      `SELECT COUNT(*) as cnt FROM (${sql}) AS subquery`,
      params,
    );
    const total = parseInt(totalRaw[0]?.cnt || '0', 10);

    if (filter.sortBy) {
      const order = filter.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      if (filter.sortBy === 'correspondentAccount') {
        qb.orderBy('MAX(txn.correspondentAccount)', order);
      } else if (filter.sortBy === 'correspondentName') {
        qb.orderBy('MAX(txn.correspondentName)', order);
      } else if (filter.sortBy === 'totalCredit') {
        qb.orderBy('SUM(COALESCE(txn.creditAmount, 0))', order);
      } else if (filter.sortBy === 'totalDebit') {
        qb.orderBy('SUM(COALESCE(txn.debitAmount, 0))', order);
      } else if (filter.sortBy === 'transactionCount') {
        qb.orderBy('COUNT(txn.id)', order);
      } else {
        qb.orderBy(
          'SUM(COALESCE(txn.creditAmount, 0)) + SUM(COALESCE(txn.debitAmount, 0))',
          'DESC',
        );
      }
    } else {
      qb.orderBy(
        'SUM(COALESCE(txn.creditAmount, 0)) + SUM(COALESCE(txn.debitAmount, 0))',
        'DESC',
      );
    }
    qb.offset((page - 1) * pageSize).limit(pageSize);

    const items = await qb.getRawMany();

    const subjectsMap: Record<string, string> = {};
    if (items.length > 0) {
      const groupConditions = items
        .map((item) => {
          const escapedId = String(item.groupId).replace(/'/g, "''");
          return `(COALESCE(NULLIF(t2.correspondent_name, ''), NULLIF(t2.correspondent_account, ''), 'Khác') = '${escapedId}')`;
        })
        .join(' OR ');

      const subjectQuery = `
        SELECT 
          COALESCE(NULLIF(t2.correspondent_name, ''), NULLIF(t2.correspondent_account, ''), 'Khác') as group_id,
          CASE WHEN inv.direction = 'IN' THEN CONCAT_WS(' - ', NULLIF(inv.seller_tax_code, ''), inv.seller_name) ELSE CONCAT_WS(' - ', NULLIF(inv.buyer_tax_code, ''), inv.buyer_name) END as subject
        FROM erp_invoice_voucher_netoff netoff
        INNER JOIN erp_invoices inv ON inv.id = netoff.invoice_id
        INNER JOIN erp_bank_transactions t2 ON t2.id = netoff.bank_transaction_id
        WHERE t2.is_deleted = false
          AND (${groupConditions})
      `;
      const subjectsRows = await this.transactionRepo.query(subjectQuery);

      const groupedSubjects = subjectsRows.reduce((acc: any, curr: any) => {
        if (!curr.subject) return acc;
        if (!acc[curr.group_id]) acc[curr.group_id] = new Set();
        acc[curr.group_id].add(curr.subject);
        return acc;
      }, {});

      for (const [groupId, set] of Object.entries(groupedSubjects)) {
        subjectsMap[groupId] = Array.from(set as Set<string>).join(', ');
      }
    }

    return {
      items: items.map((item) => ({
        id: item.groupId,
        correspondentAccount: item.correspondentAccount,
        correspondentName: item.correspondentName,
        totalCredit: parseFloat(item.totalCredit) || 0,
        totalDebit: parseFloat(item.totalDebit) || 0,
        transactionCount: parseInt(
          item.transactioncount || item.transactionCount || '0',
          10,
        ),
        invoiceSubject: subjectsMap[item.groupId] || null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getDashboardStats(filter: BankTransactionFilterDto) {
    const qb = this.transactionRepo
      .createQueryBuilder('txn')
      .leftJoinAndSelect('txn.bankAccount', 'bankAccount')
      .leftJoinAndSelect('txn.cashBook', 'cashBook')
      .where('txn.isDeleted = :isDeleted', { isDeleted: false });

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
    if (filter.sourceType) {
      qb.andWhere('txn.sourceType = :sourceType', {
        sourceType: filter.sourceType,
      });
    }
    if (filter.branchId) {
      qb.andWhere('txn.branchId = :branchId', { branchId: filter.branchId });
    }
    if (filter.tagIds && filter.tagIds.length > 0) {
      qb.innerJoin(
        'sys_entity_tags',
        'et',
        `et.entity_id = txn.id AND et.entity_type = 'bank_transaction'`,
      ).andWhere('et.tag_id IN (:...tagIds)', { tagIds: filter.tagIds });
    }

    if (filter.correspondentAccount) {
      qb.andWhere('txn.correspondentAccount = :correspondentAccount', {
        correspondentAccount: filter.correspondentAccount,
      });
    }
    if (filter.correspondentName) {
      qb.andWhere('txn.correspondentName = :correspondentName', {
        correspondentName: filter.correspondentName,
      });
    }

    const allTxns = await qb.getMany();

    let totalCashIn = 0;
    let totalCashOut = 0;
    const trendMap = new Map<string, { cashIn: number; cashOut: number }>();
    const sourceMap = new Map<
      string,
      {
        cashIn: number;
        cashOut: number;
        trendMap: Map<string, { cashIn: number; cashOut: number }>;
      }
    >();

    for (const t of allTxns) {
      const inAmt = Number(t.creditAmount || 0);
      const outAmt = Number(t.debitAmount || 0);
      totalCashIn += inAmt;
      totalCashOut += outAmt;

      const dateStr = t.transDate
        ? new Date(t.transDate).toISOString().substring(0, 7)
        : 'Unknown';
      if (!trendMap.has(dateStr)) {
        trendMap.set(dateStr, { cashIn: 0, cashOut: 0 });
      }
      const trend = trendMap.get(dateStr)!;
      trend.cashIn += inAmt;
      trend.cashOut += outAmt;

      let sourceLabel = 'Unknown';
      if (t.sourceType === 'BANK' && t.bankAccount) {
        sourceLabel = t.bankAccount.bankName
          ? `${t.bankAccount.bankName} - ${t.bankAccount.accountNumber}`
          : t.bankAccount.accountNumber || 'Bank';
      } else if (t.sourceType === 'CASH' && t.cashBook) {
        sourceLabel = t.cashBook.name || 'Cash Fund';
      }

      if (!sourceMap.has(sourceLabel)) {
        sourceMap.set(sourceLabel, {
          cashIn: 0,
          cashOut: 0,
          trendMap: new Map(),
        });
      }
      const sourceData = sourceMap.get(sourceLabel)!;
      sourceData.cashIn += inAmt;
      sourceData.cashOut += outAmt;

      if (!sourceData.trendMap.has(dateStr)) {
        sourceData.trendMap.set(dateStr, { cashIn: 0, cashOut: 0 });
      }
      const sTrend = sourceData.trendMap.get(dateStr)!;
      sTrend.cashIn += inAmt;
      sTrend.cashOut += outAmt;
    }

    const sourceBreakdown = Array.from(sourceMap.entries()).map(
      ([label, data]) => ({
        label,
        cashIn: data.cashIn,
        cashOut: data.cashOut,
        trend: Array.from(data.trendMap.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 6)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([tLabel, tData]) => ({ label: tLabel, ...tData })),
      }),
    );

    const topTransactionsIn = [...allTxns]
      .filter((t) => Number(t.creditAmount) > 0)
      .sort((a, b) => Number(b.creditAmount) - Number(a.creditAmount))
      .slice(0, 10);

    const topTransactionsOut = [...allTxns]
      .filter((t) => Number(t.debitAmount) > 0)
      .sort((a, b) => Number(b.debitAmount) - Number(a.debitAmount))
      .slice(0, 10);

    const cashTrend = Array.from(trendMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, data]) => ({ label, ...data }));

    const categoryBreakdownQb = this.transactionRepo.manager
      .createQueryBuilder()
      .select('tag.id', 'tagId')
      .addSelect('tag.name', 'label')
      .addSelect('tag.color', 'color')
      .addSelect(
        'SUM(COALESCE(txn.debit_amount, 0) + COALESCE(txn.credit_amount, 0))',
        'amount',
      )
      .from('erp_bank_transactions', 'txn')
      .innerJoin(
        'sys_entity_tags',
        'etFilter',
        "etFilter.entity_id = txn.id AND etFilter.entity_type = 'bank_transaction'",
      )
      .innerJoin('sys_tags', 'tag', 'tag.id = etFilter.tag_id')
      .where('txn.is_deleted = :isDeleted', { isDeleted: false });

    if (filter.startDate) {
      if (filter.startDate.length === 10) {
        categoryBreakdownQb.andWhere(
          "(txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= :startDate::date",
          { startDate: filter.startDate },
        );
      } else {
        categoryBreakdownQb.andWhere(
          "(txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') >= :startDate::timestamp",
          { startDate: filter.startDate },
        );
      }
    }
    if (filter.endDate) {
      if (filter.endDate.length === 10) {
        categoryBreakdownQb.andWhere(
          "(txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= :endDate::date",
          { endDate: filter.endDate },
        );
      } else {
        categoryBreakdownQb.andWhere(
          "(txn.trans_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') <= :endDate::timestamp",
          { endDate: filter.endDate },
        );
      }
    }
    if (filter.sourceType) {
      categoryBreakdownQb.andWhere('txn.source_type = :sourceType', {
        sourceType: filter.sourceType,
      });
    }
    if (filter.branchId) {
      categoryBreakdownQb.andWhere('txn.branch_id = :branchId', {
        branchId: filter.branchId,
      });
    }
    if (filter.tagIds && filter.tagIds.length > 0) {
      categoryBreakdownQb
        .innerJoin(
          'sys_entity_tags',
          'etFilter2',
          `etFilter2.entity_id = txn.id AND etFilter2.entity_type = 'bank_transaction'`,
        )
        .andWhere('etFilter2.tag_id IN (:...tagIds)', {
          tagIds: filter.tagIds,
        });
    }

    const rawCategories = await categoryBreakdownQb
      .groupBy('tag.id')
      .addGroupBy('tag.name')
      .addGroupBy('tag.color')
      .getRawMany();

    const categoryBreakdown = rawCategories.map((r) => ({
      tagId: r.tagId,
      label: r.label,
      color: r.color,
      amount: Number(r.amount || 0),
    }));

    return {
      totalCashIn,
      totalCashOut,
      netCashFlow: totalCashIn - totalCashOut,
      cashTrend,
      categoryBreakdown,
      sourceBreakdown,
      topTransactionsIn,
      topTransactionsOut,
    };
  }
}
