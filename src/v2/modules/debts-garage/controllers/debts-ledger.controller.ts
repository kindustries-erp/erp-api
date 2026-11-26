import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { ErpBranchId } from '@/v2/core/branches-core';
import { AssignDebtPartyDto } from '../dto/assign-debt-party.dto';
import { QueryDebtLedgerDto } from '../dto/query-debt-ledger.dto';
import { DebtLedgerQueryService } from '../services/debt-ledger-query.service';
import { DebtPartyService } from '../services/debt-party.service';

const DEBTS_READ = {
  resource: ErpResource.GARAGE_DEBTS,
  action: ErpAction.READ,
};
const DEBTS_UPDATE = {
  resource: ErpResource.GARAGE_DEBTS,
  action: ErpAction.UPDATE,
};

/** Sổ công nợ garage v2: đọc sổ nợ, phân bổ, và gán hãng bảo hiểm / NCC. Chi nhánh bắt buộc. */
@ApiTags('debts-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/debts-garage/ledger')
export class DebtsLedgerController {
  constructor(
    private readonly ledger: DebtLedgerQueryService,
    private readonly parties: DebtPartyService,
  ) {}

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Sổ công nợ garage' })
  @Get()
  list(
    @Query() query: QueryDebtLedgerDto,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.ledger.findPage({
      ...query,
      branchId,
    });
  }

  @RequirePermissions(DEBTS_READ)
  @ApiOperation({ summary: 'Phân bổ của một khoản nợ' })
  @Get(':debtId/allocations')
  allocations(
    @Param('debtId', ParseUUIDPipe) debtId: string,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.ledger.findAllocations(branchId, debtId);
  }

  @RequirePermissions(DEBTS_UPDATE)
  @ApiOperation({ summary: 'Gán hãng bảo hiểm / NCC cho khoản nợ' })
  @Patch(':debtId/party')
  assignParty(
    @Param('debtId', ParseUUIDPipe) debtId: string,
    @Body() dto: AssignDebtPartyDto,
    @ErpBranchId() branchId: string | undefined,
  ) {
    return this.parties.assignParty(branchId, debtId, dto);
  }
}
