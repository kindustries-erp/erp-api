import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { AuditLog } from '@/v2/core/audit-core/decorators/audit-log.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { ErpBranchId } from '@/v2/core/branches-core';
import {
  CreateCashflowVoucherGarageDto,
  UpdateCashflowVoucherGarageDto,
} from '../../cashflow-vouchers-garage/dto/create-cashflow-voucher-garage.dto';
import { ChangeVoucherStatusDto } from '../dto/allocate-debt.dto';
import { GarageDebtsFlowService } from '../services/garage-debts-flow.service';
import { actorOf, type RequestWithUser } from './flow-controller.helper';

const perm = (action: ErpAction) => ({
  resource: ErpResource.GARAGE_CASHFLOW,
  action,
});
const audit = (actionType: string) =>
  AuditLog({
    module: 'GARAGE_CASHFLOW',
    actionType,
    entityType: 'CASHFLOW_VOUCHER_GARAGE',
  });

/** Lệnh ghi phiếu thu chi garage v2. Mỗi lệnh ghi phiếu và phân bổ công nợ trong một transaction. */
@ApiTags('cashflow-vouchers-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/cashflow-vouchers-garage')
export class CashflowVoucherCommandsController {
  constructor(private readonly flow: GarageDebtsFlowService) {}

  @RequirePermissions(perm(ErpAction.CREATE))
  @audit('CREATE')
  @ApiOperation({ summary: 'Tạo phiếu thu chi' })
  @Post()
  create(
    @Body() dto: CreateCashflowVoucherGarageDto,
    @ErpBranchId() branchId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.flow.recordVoucher(branchId, dto, actorOf(req));
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @audit('UPDATE')
  @ApiOperation({ summary: 'Sửa phiếu (đảo và áp lại phân bổ nếu đã thu chi)' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCashflowVoucherGarageDto,
    @ErpBranchId() branchId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.flow.updateVoucher(branchId, id, dto, actorOf(req));
  }

  @RequirePermissions(perm(ErpAction.UPDATE))
  @audit('STATUS_CHANGE')
  @ApiOperation({ summary: 'Duyệt hoặc xác nhận đã thu chi' })
  @Post(':id/status')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeVoucherStatusDto,
    @ErpBranchId() branchId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.flow.changeVoucherStatus(
      branchId,
      id,
      dto.status,
      actorOf(req),
    );
  }

  @RequirePermissions(perm(ErpAction.DELETE))
  @audit('CANCEL')
  @ApiOperation({ summary: 'Hủy phiếu (đảo phân bổ, không xóa cứng)' })
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @ErpBranchId() branchId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.flow.changeVoucherStatus(
      branchId,
      id,
      'CANCELLED',
      actorOf(req),
    );
  }
}
