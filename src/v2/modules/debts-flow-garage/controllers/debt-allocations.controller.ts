import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { AuditLog } from '@/v2/core/audit-core/decorators/audit-log.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { ErpBranchId } from '@/v2/core/branches-core';
import { AllocateDebtDto } from '../dto/allocate-debt.dto';
import { GarageDebtAllocationFlowService } from '../services/garage-debt-allocation-flow.service';
import {
  actorOf,
  requireIdempotencyKey,
  type RequestWithUser,
} from './flow-controller.helper';

const UPDATE = { resource: ErpResource.GARAGE_DEBTS, action: ErpAction.UPDATE };
const audit = (actionType: string) =>
  AuditLog({
    module: 'GARAGE_DEBTS',
    actionType,
    entityType: 'DEBT_ALLOCATION_GARAGE',
  });
const KEY_HEADER = { name: 'Idempotency-Key', required: true };

/** Phân bổ thủ công và đảo phân bổ công nợ garage. Cả hai bắt buộc `Idempotency-Key`. */
@ApiTags('debts-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/debts-garage/allocations')
export class DebtAllocationsController {
  constructor(private readonly flow: GarageDebtAllocationFlowService) {}

  @RequirePermissions(UPDATE)
  @audit('ALLOCATE')
  @ApiHeader(KEY_HEADER)
  @ApiOperation({ summary: 'Phân bổ vào khoản nợ' })
  @Post()
  allocate(
    @Body() dto: AllocateDebtDto,
    @Headers('idempotency-key') key: string | undefined,
    @ErpBranchId() branchId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.flow.allocate(
      branchId,
      dto,
      requireIdempotencyKey(key),
      actorOf(req),
    );
  }

  @RequirePermissions(UPDATE)
  @audit('REVERSE_ALLOCATION')
  @ApiHeader(KEY_HEADER)
  @ApiOperation({ summary: 'Đảo một phân bổ' })
  @Post(':id/reverse')
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @ErpBranchId() branchId: string | undefined,
    @Req() req: RequestWithUser,
  ) {
    return this.flow.reverseAllocation(
      branchId,
      id,
      requireIdempotencyKey(key),
      actorOf(req),
    );
  }
}
