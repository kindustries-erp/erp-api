import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  QueryStockBalanceDto,
  QueryStockTransactionDto,
  StockLedgerQueryService,
} from '@/v2/core/inventory-movements-core';
import { INVENTORY_MOVEMENTS_GARAGE_LEDGER } from './config/inventory-movements-garage-ledger.config';

/** Facade đọc tồn kho Garage: số dư theo mã hàng và thẻ kho. Chỉ đọc. */
@Injectable()
export class InventoryMovementsGarageLedgerService {
  private readonly query: StockLedgerQueryService;

  constructor(@InjectDataSource() dataSource: DataSource) {
    this.query = new StockLedgerQueryService(
      dataSource,
      INVENTORY_MOVEMENTS_GARAGE_LEDGER,
    );
  }

  listBalances(query: QueryStockBalanceDto) {
    return this.query.listBalances(query);
  }

  listTransactions(query: QueryStockTransactionDto) {
    return this.query.listTransactions(query);
  }
}
