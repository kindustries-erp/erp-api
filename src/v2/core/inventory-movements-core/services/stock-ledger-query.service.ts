import { DataSource, SelectQueryBuilder } from 'typeorm';
import { buildPagination } from '@/common/utils/paginated-result';
import type { StockLedgerConfig } from '../contracts/inventory-movements-core.contract';
import type {
  QueryStockBalanceDto,
  QueryStockTransactionDto,
  StockTab,
} from '../dto/query-stock-ledger.dto';
import type {
  StockBalanceItemDto,
  StockTransactionItemDto,
} from '../dto/stock-ledger-response.dto';
import { toNumber } from '../helpers/decimal.helper';
import {
  loadMovementSumsByItem,
  loadMovementTotals,
} from '../helpers/stock-ledger-movement-sums.helper';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const SORTABLE: Record<string, string> = {
  itemCode: 'b.itemCode',
  itemName: 'b.itemName',
  qtyOnHand: 'b.qtyOnHand',
  avgCost: 'b.avgCost',
  inventoryValue: 'b.inventoryValue',
  updatedAt: 'b.updatedAt',
};
const TAB_CONDITION: Record<StockTab, string | null> = {
  ALL: null,
  IN_STOCK: 'b.qtyOnHand > 0',
  OUT_OF_STOCK: 'b.qtyOnHand = 0',
  NEGATIVE: 'b.qtyOnHand < 0',
};

/**
 * Đọc số dư và thẻ kho của một ledger. Chỉ đọc. Phạm vi ledger lấy từ cấu hình của module,
 * bảng lấy qua entity trong cấu hình nên lõi không biết tên bảng hay tên họ.
 */
export class StockLedgerQueryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: StockLedgerConfig,
  ) {}

  async listBalances(query: QueryStockBalanceDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    const base = (tab?: StockTab) => this.balanceBase(query.search, tab);

    const qb = base(query.stockTab);
    const orders = (query.sort ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => SORTABLE[t.replace(/^-/, '')])
      .map((t): [string, 'ASC' | 'DESC'] => [
        SORTABLE[t.replace(/^-/, '')],
        t.startsWith('-') ? 'DESC' : 'ASC',
      ]);
    if (!orders.length) orders.push(['b.itemCode', 'ASC']);
    orders.forEach(([col, dir], i) =>
      i === 0 ? qb.orderBy(col, dir) : qb.addOrderBy(col, dir),
    );
    qb.addOrderBy('b.id', 'ASC');
    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const pageMovements = await loadMovementSumsByItem(
      this.dataSource,
      this.config,
      rows.map((r) => r.itemCode),
    );
    const matchingCodes = (
      await base(query.stockTab)
        .select('b.itemCode', 'itemCode')
        .getRawMany<{ itemCode: string }>()
    ).map((r) => r.itemCode);
    const totalMovements = await loadMovementTotals(
      this.dataSource,
      this.config,
      matchingCodes,
    );

    const sums = await base(query.stockTab)
      .select('COALESCE(SUM(b.qtyOnHand), 0)', 'totalQty')
      .addSelect('COALESCE(SUM(b.inventoryValue), 0)', 'totalValue')
      .getRawOne<{ totalQty: string; totalValue: string }>();

    const tabCounts: Record<string, number> = {};
    for (const tab of Object.keys(TAB_CONDITION) as StockTab[]) {
      tabCounts[tab] = await base(tab).getCount();
    }

    const items: StockBalanceItemDto[] = rows.map((r) => ({
      id: r.id,
      branchId: r.branchId,
      itemCode: r.itemCode,
      itemName: r.itemName,
      unit: r.unit,
      qtyOnHand: toNumber(r.qtyOnHand),
      avgCost: toNumber(r.avgCost),
      inventoryValue: toNumber(r.inventoryValue),
      qtyReceived: pageMovements.get(r.itemCode)?.qtyReceived ?? 0,
      qtyIssued: pageMovements.get(r.itemCode)?.qtyIssued ?? 0,
      qtyAdjusted: pageMovements.get(r.itemCode)?.qtyAdjusted ?? 0,
      updatedAt: r.updatedAt,
    }));
    const pageSum = (pick: (item: StockBalanceItemDto) => number) =>
      items.reduce((acc, item) => acc + pick(item), 0);
    // Cumulative bằng tổng toàn bộ (bảng không hiển thị lũy kế), cùng quy ước với chứng từ gộp
    const metric = (total: number, pageSubtotal: number) => ({
      total,
      pageSubtotal,
      cumulative: total,
    });
    return {
      items,
      pagination: buildPagination(page, pageSize, total),
      summaries: {
        qtyOnHand: metric(
          toNumber(sums?.totalQty),
          pageSum((i) => i.qtyOnHand),
        ),
        inventoryValue: metric(
          toNumber(sums?.totalValue),
          pageSum((i) => i.inventoryValue),
        ),
        qtyReceived: metric(
          totalMovements.qtyReceived,
          pageSum((i) => i.qtyReceived),
        ),
        qtyIssued: metric(
          totalMovements.qtyIssued,
          pageSum((i) => i.qtyIssued),
        ),
        qtyAdjusted: metric(
          totalMovements.qtyAdjusted,
          pageSum((i) => i.qtyAdjusted),
        ),
      },
      extraData: { tabCounts },
    };
  }

  async listTransactions(query: QueryStockTransactionDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 20));
    const qb = this.dataSource
      .getRepository(this.config.tables.transaction)
      .createQueryBuilder('t')
      .where('t.ledgerScope = :scope', { scope: this.config.ledgerScope })
      .andWhere('t.itemCode = :itemCode', { itemCode: query.itemCode });
    const day = `(t.transactionDate AT TIME ZONE '${TIME_ZONE}')::date`;
    if (query.dateFrom)
      qb.andWhere(`${day} >= :from::date`, { from: query.dateFrom });
    if (query.dateTo) qb.andWhere(`${day} <= :to::date`, { to: query.dateTo });
    const [rows, total] = await qb
      .orderBy('t.transactionDate', 'DESC')
      .addOrderBy('t.createdAt', 'DESC')
      .addOrderBy('t.id', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    const items: StockTransactionItemDto[] = rows.map((r) => ({
      id: r.id,
      transactionDate: r.transactionDate,
      transactionType: r.transactionType,
      documentType: r.documentType,
      documentId: r.documentId,
      qtyIn: toNumber(r.qtyIn),
      qtyOut: toNumber(r.qtyOut),
      unitCost: toNumber(r.unitCost),
    }));
    return { items, pagination: buildPagination(page, pageSize, total) };
  }

  private balanceBase(
    search?: string,
    tab?: StockTab,
  ): SelectQueryBuilder<any> {
    const qb = this.dataSource
      .getRepository(this.config.tables.balance)
      .createQueryBuilder('b')
      .where('b.ledgerScope = :scope', { scope: this.config.ledgerScope });
    const term = search?.trim();
    if (term) {
      qb.andWhere('(b.itemCode ILIKE :q OR b.itemName ILIKE :q)', {
        q: `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
      });
    }
    const cond = TAB_CONDITION[tab ?? 'ALL'];
    if (cond) qb.andWhere(cond);
    return qb;
  }
}
