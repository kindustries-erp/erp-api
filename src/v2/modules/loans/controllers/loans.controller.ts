import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import { LoansService } from '../loans.service';
import {
  BatchCreateLoansDto,
  CashflowProjectionResponseDto,
  CreateLoanDto,
  LoanListResponseDto,
  LoanResponseDto,
  QueryLoanDto,
  RecordPaymentDto,
  UpdateLoanDto,
} from '../dto';

interface RequestWithUser {
  user?: { sub?: string };
}

@ApiTags('loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Lấy danh sách các khoản vay' })
  @ApiOkResponse({ type: LoanListResponseDto })
  findAll(@Query() query: QueryLoanDto): Promise<LoanListResponseDto> {
    return this.loansService.findAll(query);
  }

  @Get('cashflow/projection')
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Dự toán dòng tiền trả nợ tương lai đa khoản vay' })
  getCashflowProjection(): Promise<CashflowProjectionResponseDto> {
    return this.loansService.getCashflowProjection();
  }

  @Get(':id')
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Chi tiết khoản vay kèm bảng phân kỳ' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<LoanResponseDto> {
    return this.loansService.findOne(id);
  }

  @Post()
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo mới hợp đồng vay' })
  create(
    @Body() dto: CreateLoanDto,
    @Req() req: RequestWithUser,
  ): Promise<LoanResponseDto> {
    return this.loansService.create(dto, req.user?.sub);
  }

  @Post('batch')
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Tạo hàng loạt hợp đồng vay (Batch)' })
  createBatch(
    @Body() dto: BatchCreateLoansDto,
    @Req() req: RequestWithUser,
  ): Promise<LoanResponseDto[]> {
    return this.loansService.createBatch(dto.loans, req.user?.sub);
  }

  @Patch(':id')
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Cập nhật thông tin khoản vay' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoanDto,
  ): Promise<LoanResponseDto> {
    return this.loansService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Xóa mềm khoản vay' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.loansService.remove(id);
  }

  @Post(':id/payments')
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Ghi nhận thanh toán kỳ của khoản vay' })
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
    @Req() req: RequestWithUser,
  ): Promise<LoanResponseDto> {
    return this.loansService.recordPayment(id, dto, req.user?.sub);
  }
}
