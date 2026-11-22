import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  QueryStockVoucherUnionDto,
  QueryStockVoucherUnionOptionsDto,
  StockVoucherUnionQueryService,
} from '@/v2/core/inventory-movements-core';
import { GARAGE_STOCK_VOUCHER_SOURCES } from './config/inventory-movements-garage-vouchers.config';

/** Facade danh sách chứng từ kho Garage gộp 4 loại phiếu. Chỉ đọc. */
@Injectable()
export class InventoryMovementsGarageVouchersService {
  private readonly union: StockVoucherUnionQueryService;

  constructor(@InjectDataSource() dataSource: DataSource) {
    this.union = new StockVoucherUnionQueryService(
      dataSource,
      GARAGE_STOCK_VOUCHER_SOURCES,
    );
  }

  list(query: QueryStockVoucherUnionDto) {
    return this.union.findAll(query);
  }

  columnOptions(query: QueryStockVoucherUnionOptionsDto) {
    return this.union.findColumnOptions(query);
  }
}
