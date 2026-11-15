import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import {
  QueryStockBalanceDto,
  QueryStockTransactionDto,
  StockBalanceListResponseDto,
  StockTransactionListResponseDto,
} from '@/v2/core/inventory-movements-core';
import { InventoryMovementsGarageLedgerService } from '../inventory-movements-garage-ledger.service';

@ApiTags('inventory-movements-garage-ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/inventory-movements-garage-ledger')
export class InventoryMovementsGarageLedgerController {
  constructor(
    private readonly service: InventoryMovementsGarageLedgerService,
  ) {}

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_LEDGER,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Tồn kho Garage theo mã hàng' })
  @ApiOkResponse({ type: StockBalanceListResponseDto })
  @Get('balances')
  balances(@Query() query: QueryStockBalanceDto) {
    return this.service.listBalances(query);
  }

  @RequirePermissions({
    resource: ErpResource.GARAGE_STOCK_LEDGER,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Thẻ kho Garage của một mã hàng' })
  @ApiOkResponse({ type: StockTransactionListResponseDto })
  @Get('transactions')
  transactions(@Query() query: QueryStockTransactionDto) {
    return this.service.listTransactions(query);
  }
}
