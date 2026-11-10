import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type {
  StockLedgerConfig,
  StockMoveLine,
} from '../contracts/inventory-movements-core.contract';
import type { BaseStockTransactionEntity } from '../entities/ledger/base-stock-transaction.entity';
import { costingStrategyFor } from '../costing/costing.factory';
import { roundTo, toNumber } from '../helpers/decimal.helper';
import { StockBalanceService, StockLedgerKey } from './stock-balance.service';

/** Thông tin chứng từ gốc của một lần ghi sổ hoặc đảo sổ. */
export interface StockDocumentContext {
  branchId: string | null;
  documentType: string;
  documentId: string;
  transactionDate: Date;
  createdBy: string | null;
}

export interface PostedStockLine extends StockMoveLine {
  /** Giá đơn vị thực tế đã ghi sổ: giá nhập với IN, giá vốn tính được với OUT. */
  appliedUnitCost: number;
}

const CANCEL_SUFFIX = '_CANCEL';

/**
 * Điều phối cộng/trừ tồn cho một chứng từ. Chạy trong transaction của chứng từ (đã khóa header),
 * khóa từng dòng số dư theo thứ tự mã hàng để tránh deadlock, và ghi sổ giao dịch cho mỗi dòng.
 * Tồn âm không được phép: xuất thiếu thì ném lỗi, không cắt về 0.
 */
@Injectable()
export class StockMovementEngineService {
  constructor(private readonly balances: StockBalanceService) {}

  async post(
    manager: EntityManager,
    config: StockLedgerConfig,
    ctx: StockDocumentContext,
    lines: StockMoveLine[],
  ): Promise<PostedStockLine[]> {
    const strategy = costingStrategyFor(config.costingMethod);
    const results = new Map<number, PostedStockLine>();

    const ordered = lines
      .map((line, index) => ({ line, index }))
      .sort((a, b) => compareItemCode(a.line.itemCode, b.line.itemCode));

    for (const { line, index } of ordered) {
      validateLine(line);
      const key = toKey(config, ctx, line.itemCode);
      await this.balances.ensureRow(
        manager,
        config.tables,
        key,
        line.itemName,
        line.unit,
      );
      const balance = await this.balances.lockRow(manager, config.tables, key);
      const onHand = toNumber(balance.qtyOnHand);

      if (line.direction === 'OUT') {
        if (onHand < line.qty) {
          throw new BadRequestException(
            `Tồn kho không đủ cho ${line.itemCode}: còn ${roundTo(onHand, 3)}, cần ${line.qty}`,
          );
        }
        const unitCost = await strategy.issue(
          {
            manager,
            balance,
            transactionDate: ctx.transactionDate,
            tables: config.tables,
          },
          line.qty,
        );
        await manager.save(config.tables.balance, balance);
        await this.writeTransaction(
          manager,
          config,
          ctx,
          key,
          line,
          line.qty,
          unitCost,
          'OUT',
        );
        results.set(index, { ...line, appliedUnitCost: unitCost });
      } else {
        const unitCost = toNumber(line.unitCost);
        await strategy.receive(
          {
            manager,
            balance,
            transactionDate: ctx.transactionDate,
            tables: config.tables,
          },
          line.qty,
          unitCost,
        );
        await manager.save(config.tables.balance, balance);
        await this.writeTransaction(
          manager,
          config,
          ctx,
          key,
          line,
          line.qty,
          unitCost,
          'IN',
        );
        results.set(index, { ...line, appliedUnitCost: unitCost });
      }
    }

    return lines.map((_, index) => results.get(index) as PostedStockLine);
  }

  /**
   * Đảo toàn bộ tồn đã ghi của một chứng từ. Mỗi dòng gốc được đảo đúng số lượng và giá đã ghi,
   * nên giá trị tồn quay về đúng như trước khi ghi sổ. Ghi thêm bút toán _CANCEL, không xóa bút toán gốc.
   */
  async reverse(
    manager: EntityManager,
    config: StockLedgerConfig,
    ctx: StockDocumentContext,
  ): Promise<void> {
    const txRepo = manager.getRepository(config.tables.transaction);
    const originals = await txRepo.find({
      where: {
        ledgerScope: config.ledgerScope,
        documentType: ctx.documentType,
        documentId: ctx.documentId,
      },
      order: { itemCode: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
    if (originals.some((row) => row.transactionType.endsWith(CANCEL_SUFFIX))) {
      throw new ConflictException('Chứng từ đã được đảo sổ trước đó');
    }

    const strategy = costingStrategyFor(config.costingMethod);
    for (const row of originals) {
      const key: StockLedgerKey = {
        ledgerScope: row.ledgerScope,
        branchId: row.branchId,
        itemCode: row.itemCode,
      };
      const balance = await this.balances.lockRow(manager, config.tables, key);
      const txCtx = {
        manager,
        balance,
        transactionDate: ctx.transactionDate,
        tables: config.tables,
      };
      const qtyIn = toNumber(row.qtyIn);
      const qtyOut = toNumber(row.qtyOut);
      const unitCost = toNumber(row.unitCost);

      if (qtyIn > 0) {
        if (toNumber(balance.qtyOnHand) < qtyIn) {
          throw new BadRequestException(
            `Không thể hủy: tồn ${row.itemCode} không đủ để hoàn nhập ${qtyIn}`,
          );
        }
        await strategy.withdrawReceived(txCtx, qtyIn, unitCost);
        await manager.save(config.tables.balance, balance);
        // Đảo phiếu nhập là một lần xuất: ghi vào cột qtyOut.
        await this.writeReversal(manager, config, row, ctx, 0, qtyIn, unitCost);
      } else if (qtyOut > 0) {
        await strategy.receive(txCtx, qtyOut, unitCost);
        await manager.save(config.tables.balance, balance);
        // Đảo phiếu xuất là một lần nhập lại: ghi vào cột qtyIn.
        await this.writeReversal(
          manager,
          config,
          row,
          ctx,
          qtyOut,
          0,
          unitCost,
        );
      }
    }
  }

  private async writeTransaction(
    manager: EntityManager,
    config: StockLedgerConfig,
    ctx: StockDocumentContext,
    key: StockLedgerKey,
    line: StockMoveLine,
    qty: number,
    unitCost: number,
    side: 'IN' | 'OUT',
  ): Promise<void> {
    await manager.getRepository(config.tables.transaction).insert({
      ledgerScope: config.ledgerScope,
      branchId: key.branchId,
      itemCode: key.itemCode,
      transactionType: line.transactionType,
      documentType: ctx.documentType,
      documentId: ctx.documentId,
      qtyIn: String(side === 'IN' ? qty : 0),
      qtyOut: String(side === 'OUT' ? qty : 0),
      unitCost: String(roundTo(unitCost, 2)),
      transactionDate: ctx.transactionDate,
      createdBy: ctx.createdBy,
    });
  }

  private async writeReversal(
    manager: EntityManager,
    config: StockLedgerConfig,
    original: BaseStockTransactionEntity,
    ctx: StockDocumentContext,
    qtyIn: number,
    qtyOut: number,
    unitCost: number,
  ): Promise<void> {
    await manager.getRepository(config.tables.transaction).insert({
      ledgerScope: original.ledgerScope,
      branchId: original.branchId,
      itemCode: original.itemCode,
      transactionType: `${original.transactionType}${CANCEL_SUFFIX}`,
      documentType: ctx.documentType,
      documentId: ctx.documentId,
      qtyIn: String(qtyIn),
      qtyOut: String(qtyOut),
      unitCost: String(roundTo(unitCost, 2)),
      transactionDate: ctx.transactionDate,
      createdBy: ctx.createdBy,
    });
  }
}

function toKey(
  config: StockLedgerConfig,
  ctx: StockDocumentContext,
  itemCode: string,
): StockLedgerKey {
  return {
    ledgerScope: config.ledgerScope,
    branchId: ctx.branchId ?? null,
    itemCode,
  };
}

function validateLine(line: StockMoveLine): void {
  if (!line.itemCode) {
    throw new BadRequestException('Dòng phiếu thiếu mã hàng');
  }
  if (!(line.qty > 0)) {
    throw new BadRequestException(
      `Số lượng của ${line.itemCode} phải lớn hơn 0`,
    );
  }
  if (
    line.direction === 'IN' &&
    (line.unitCost === undefined || line.unitCost === null || line.unitCost < 0)
  ) {
    throw new BadRequestException(
      `Dòng nhập ${line.itemCode} thiếu giá hợp lệ`,
    );
  }
}

function compareItemCode(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
