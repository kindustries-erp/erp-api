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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction } from '@/rbac-core/enums/erp-action.enum';
import { ErpResource } from '@/rbac-core/enums/erp-resource.enum';
import { InvoicesService } from '../invoices.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { QueryInvoiceDto } from '../dto/query-invoice.dto';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto';
import { BulkSetBranchDto, BulkSetNotesDto } from '../dto/bulk-invoice.dto';

/** JWT payload đưa vào `req.user` bởi JwtStrategy (`sub` = id người dùng). */
interface RequestWithUser {
  user?: { sub?: string };
}

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/invoices')
export class InvoiceController {
  constructor(private readonly service: InvoicesService) {}

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'List invoices (paginated, searchable)' })
  @Get()
  findAll(@Query() query: QueryInvoiceDto) {
    return this.service.findAll(query);
  }

  // Đặt trước `:id` để `column-options` không bị hiểu thành id
  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @ApiOperation({
    summary: 'Distinct values of one column, filtered by the other columns',
  })
  @Get('column-options')
  columnOptions(
    @Query('column') column: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('filters') filters?: string,
  ) {
    return this.service.findColumnOptions(
      column,
      search,
      Math.max(1, parseInt(page, 10) || 1),
      Math.max(1, Math.min(200, parseInt(pageSize, 10) || 20)),
      filters,
    );
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.READ,
  })
  @ApiOperation({ summary: 'Get one invoice' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.CREATE,
  })
  @ApiOperation({ summary: 'Create an invoice' })
  @Post()
  create(@Body() dto: CreateInvoiceDto, @Req() req: RequestWithUser) {
    return this.service.create(dto, req.user?.sub);
  }

  // Đặt trước `:id` để `bulk-set-*` không bị hiểu thành id
  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({
    summary: 'Set the branches of many invoices (POSTED ones are skipped)',
  })
  @Patch('bulk-set-branch')
  bulkSetBranch(@Body() dto: BulkSetBranchDto) {
    return this.service.bulkSetBranch(dto.ids, dto.branchIds);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Set the notes of many invoices' })
  @Patch('bulk-set-notes')
  bulkSetNotes(@Body() dto: BulkSetNotesDto) {
    return this.service.bulkSetNotes(dto.ids, dto.notes ?? null);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.UPDATE,
  })
  @ApiOperation({ summary: 'Update an invoice' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.service.update(id, dto);
  }

  @RequirePermissions({
    resource: ErpResource.INVOICES,
    action: ErpAction.DELETE,
  })
  @ApiOperation({ summary: 'Soft-delete a draft invoice' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
