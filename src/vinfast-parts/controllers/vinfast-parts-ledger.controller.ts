import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/rbac-core/enums';
import { VinfastPartsService } from '../vinfast-parts.service';

@ApiTags('VinFast Parts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('vinfast-parts')
export class VinfastPartsLedgerController {
  constructor(private readonly vinfastPartsService: VinfastPartsService) {}

  @Get('ledger/:sku')
  @RequirePermissions({ resource: ErpResource.VINFAST, action: ErpAction.READ })
  @ApiOperation({ summary: 'Get VinFast parts ledger history (FIFO trace)' })
  async getLedgerHistory(@Param('sku') sku: string) {
    return this.vinfastPartsService.getPartLedgerHistory(sku);
  }

  @Get('fifo-rows/:sku')
  @RequirePermissions({ resource: ErpResource.VINFAST, action: ErpAction.READ })
  @ApiOperation({ summary: 'Get VinFast parts FIFO unit ledger rows' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFifoUnitRows(
    @Param('sku') sku: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.vinfastPartsService.getFifoUnitRows(sku, pageNum, limitNum);
  }
}
