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
  UpdatePaymentDto,
} from '../dto';

interface RequestWithUser {
  user?: { sub?: string };
}

@ApiTags('loans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/loans-tool')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.READ,
  })
  @ApiOkResponse({ type: LoanListResponseDto })
  @ApiOperation({ summary: 'Lấy danh sách các khoản vay' })
  @ApiOkResponse({ type: LoanListResponseDto })
  findAll(@Query() query: QueryLoanDto): Promise<LoanListResponseDto> {
    return this.loansService.findAll(query);
  }

  @Get('column-options')
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.READ,
  })
  @ApiOperation({
    summary: 'Gợi ý giá trị của một cột, áp dụng bộ lọc các cột khác',
  })
  columnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('filters') filters?: string,
    @Query('deleted') deleted?: string,
  ) {
    return this.loansService.findColumnOptions(
      column,
      search,
      Math.max(1, parseInt(page, 10) || 1),
      Math.max(1, Math.min(200, parseInt(pageSize, 10) || 20)),
      filters,
      deleted === 'only' ? 'only' : undefined,
    );
  }

  @Get('cashflow/projection')
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.READ,
  })
  @ApiOperation({
    summary: 'Dự toán dòng tiền trả nợ tương lai hoặc toàn kỳ đa khoản vay',
  })
  getCashflowProjection(
    @Query('includeAllPeriods') includeAllPeriods?: string,
  ): Promise<CashflowProjectionResponseDto> {
    return this.loansService.getCashflowProjection(
      includeAllPeriods === 'true' || includeAllPeriods === '1',
    );
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

  @Delete(':id/permanent')
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.PURGE,
  })
  @ApiOperation({
    summary:
      'Xóa cứng khoản vay đã xóa mềm (chỉ quyền PURGE, chặn khi có lịch sử thanh toán)',
  })
  hardDelete(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.loansService.hardDelete(id);
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

  @Patch(':id/payments/:paymentId')
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Cập nhật bản ghi thanh toán của khoản vay' })
  updatePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: UpdatePaymentDto,
  ): Promise<LoanResponseDto> {
    return this.loansService.updatePayment(id, paymentId, dto);
  }

  @Delete(':id/payments/:paymentId')
  @RequirePermissions({
    resource: ErpResource.LOANS,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Xóa bản ghi thanh toán của khoản vay' })
  deletePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ): Promise<LoanResponseDto> {
    return this.loansService.deletePayment(id, paymentId);
  }
}
