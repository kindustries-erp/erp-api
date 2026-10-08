import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { ErpResource, ErpAction } from '@/rbac-core/enums';
import { BranchId } from '../decorators/branch-id.decorator';
import { KgaraSuppliersService } from '../services/kgara-suppliers.service';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway')
export class KgaraSuppliersController {
  constructor(private readonly suppliersService: KgaraSuppliersService) {}

  @Get('payables/suppliers-debt')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getSuppliersDebt(
    @BranchId() branchId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('q') q: string = '',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sorts') sorts?: string | string[],
    @Query('filtersStr') filtersStr?: string,
    @Query('column_filters') columnFiltersParam?: string,
    @Query('column_search') columnSearchParam?: string,
  ) {
    return this.suppliersService.getSuppliersDebt({
      branchId,
      page,
      pageSize,
      q,
      from,
      to,
      sorts,
      filtersStr,
      column_filters: columnFiltersParam,
      column_search: columnSearchParam,
    });
  }

  @Get('payables/suppliers-debt/column-options')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getSuppliersDebtColumnOptions(
    @BranchId() branchId: string,
    @Query('column') column: string,
    @Query('search') search: string = '',
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('filtersStr') filtersStr?: string,
  ) {
    return this.suppliersService.getSuppliersDebtColumnOptions(
      branchId,
      column,
      search,
      page,
      pageSize,
      filtersStr,
    );
  }

  @Get('payables/by-supplier/:supplierId/cases')
  @RequirePermissions({ resource: ErpResource.GARAGE, action: ErpAction.READ })
  async getCasesBySupplier(
    @BranchId() branchId: string,
    @Param('supplierId') supplierId: string,
  ) {
    return this.suppliersService.getCasesBySupplier(branchId, supplierId);
  }
}
