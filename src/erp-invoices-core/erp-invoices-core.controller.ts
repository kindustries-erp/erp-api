import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErpInvoicesCoreService } from './erp-invoices-core.service';
import type { ErpInvoiceQuery } from './erp-invoices-core.service';
import { CreateErpInvoiceDto } from './dto/create-erp-invoice.dto';
import { UpdateErpInvoiceDto } from './dto/update-erp-invoice.dto';

@ApiTags('erp_invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('erp-invoices')
export class ErpInvoicesCoreController {
  constructor(private readonly service: ErpInvoicesCoreService) {}

  // ---------------------------------------------------------------------------
  // CRUD cơ bản
  // ---------------------------------------------------------------------------

  @Get()
  @ApiQuery({ name: 'direction', required: false, enum: ['IN', 'OUT'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  findAll(@Query() query: ErpInvoiceQuery) {
    return this.service.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateErpInvoiceDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateErpInvoiceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  // ---------------------------------------------------------------------------
  // Bulk XML import
  // ---------------------------------------------------------------------------

  /**
   * POST /api/v1/erp-invoices/bulk-import-xml/buyer
   * Import hàng loạt XML hóa đơn đầu vào (direction = IN)
   */
  @Post('bulk-import-xml/buyer')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 200, {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB/file
      fileFilter: (_req, file, cb) => {
        const ok =
          file.originalname.toLowerCase().endsWith('.xml') ||
          file.mimetype === 'application/xml' ||
          file.mimetype === 'text/xml';
        if (!ok) {
          cb(
            new BadRequestException(
              `File "${file.originalname}" không phải .xml`,
            ),
            false,
          );
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async bulkImportBuyer(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Chưa chọn file XML nào');
    }
    return this.service.bulkImportBuyerXml(
      files.map((f) => ({ filename: f.originalname, buffer: f.buffer })),
    );
  }

  /**
   * POST /api/v1/erp-invoices/bulk-import-xml/seller
   * Import hàng loạt XML hóa đơn đầu ra (direction = OUT)
   */
  @Post('bulk-import-xml/seller')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', 200, {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.originalname.toLowerCase().endsWith('.xml') ||
          file.mimetype === 'application/xml' ||
          file.mimetype === 'text/xml';
        if (!ok) {
          cb(
            new BadRequestException(
              `File "${file.originalname}" không phải .xml`,
            ),
            false,
          );
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async bulkImportSeller(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Chưa chọn file XML nào');
    }
    return this.service.bulkImportSellerXml(
      files.map((f) => ({ filename: f.originalname, buffer: f.buffer })),
    );
  }

  // ---------------------------------------------------------------------------
  // Pre-signed URLs
  // ---------------------------------------------------------------------------

  /**
   * GET /api/v1/erp-invoices/:id/download-url?type=pdf|xml
   */
  @Get(':id/download-url')
  @ApiQuery({ name: 'type', required: true, enum: ['pdf', 'xml'] })
  getDownloadUrl(@Param('id') id: string, @Query('type') type: 'pdf' | 'xml') {
    if (!['pdf', 'xml'].includes(type)) {
      throw new BadRequestException('type phải là pdf hoặc xml');
    }
    return this.service.getFileDownloadUrl(id, type);
  }

  /**
   * POST /api/v1/erp-invoices/:id/upload-url
   * Body: { fileType: 'pdf' | 'xml' }
   */
  @Post(':id/upload-url')
  getUploadUrl(
    @Param('id') id: string,
    @Body() body: { fileType: 'pdf' | 'xml' },
  ) {
    if (!['pdf', 'xml'].includes(body.fileType)) {
      throw new BadRequestException('fileType phải là pdf hoặc xml');
    }
    return this.service.getFileUploadUrl(id, body.fileType);
  }
}
