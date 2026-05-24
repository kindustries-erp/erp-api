import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DirectusAuthGuard } from '../auth/guards/directus-auth.guard';
import { UserToken } from '../common/decorators/user-token.decorator';
import {
  AddAllocationDto,
  AddRelatedDocumentDto,
  CashflowVoucherQueryDto,
  CounterpartyLookupQueryDto,
} from './dto/cashflow-voucher-query.dto';
import { CreateCashflowVoucherDto } from './dto/create-cashflow-voucher.dto';
import {
  CancelCashflowVoucherDto,
  PostCashflowVoucherDto,
  UpdateCashflowVoucherDto,
} from './dto/update-cashflow-voucher.dto';
import { CashflowVouchersService } from './cashflow-vouchers.service';

@ApiTags('CashflowVouchers')
@ApiBearerAuth()
@Controller('cashflow-vouchers')
@UseGuards(DirectusAuthGuard)
export class CashflowVouchersController {
  constructor(private readonly service: CashflowVouchersService) {}

  @Post()
  create(@Body() dto: CreateCashflowVoucherDto, @UserToken() token: string) {
    return this.service.create(dto, token);
  }

  @Get()
  findAll(@Query() query: CashflowVoucherQueryDto, @UserToken() token: string) {
    return this.service.findAll(query, token);
  }

  @Get('lookup/parties')
  @ApiOperation({ summary: 'Unified party lookup for INTERNAL/EXTERNAL' })
  findParties(
    @Query() query: CounterpartyLookupQueryDto,
    @UserToken() token: string,
  ) {
    return this.service.findParties(query, token);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @UserToken() token: string) {
    return this.service.findOne(id, token);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string, @UserToken() token: string) {
    return this.service.getTimeline(id, token);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCashflowVoucherDto,
    @UserToken() token: string,
  ) {
    return this.service.update(id, dto, token);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @UserToken() token: string) {
    return this.service.remove(id, token);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelCashflowVoucherDto,
    @UserToken() token: string,
  ) {
    return this.service.cancel(id, dto, token);
  }

  @Post(':id/post')
  postVoucher(
    @Param('id') id: string,
    @Body() dto: PostCashflowVoucherDto,
    @UserToken() token: string,
  ) {
    return this.service.postVoucher(id, dto, token);
  }

  @Get(':id/related-documents')
  getRelatedDocuments(@Param('id') id: string, @UserToken() token: string) {
    return this.service.getRelatedDocuments(id, token);
  }

  @Post(':id/related-documents')
  addRelatedDocument(
    @Param('id') id: string,
    @Body() dto: AddRelatedDocumentDto,
    @UserToken() token: string,
  ) {
    return this.service.addRelatedDocument(id, dto, token);
  }

  @Delete(':id/related-documents/:relatedId')
  removeRelatedDocument(
    @Param('id') id: string,
    @Param('relatedId') relatedId: string,
    @UserToken() token: string,
  ) {
    return this.service.removeRelatedDocument(id, relatedId, token);
  }

  @Get(':id/allocations')
  getAllocations(@Param('id') id: string, @UserToken() token: string) {
    return this.service.getAllocations(id, token);
  }

  @Post(':id/allocations')
  addAllocation(
    @Param('id') id: string,
    @Body() dto: AddAllocationDto,
    @UserToken() token: string,
  ) {
    return this.service.addAllocation(id, dto, token);
  }

  @Delete(':id/allocations/:allocationId')
  removeAllocation(
    @Param('id') id: string,
    @Param('allocationId') allocationId: string,
    @UserToken() token: string,
  ) {
    return this.service.removeAllocation(id, allocationId, token);
  }
}
