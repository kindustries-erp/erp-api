import {
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CoreRbacGuard } from '@/auth/guards/core-rbac.guard';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { ErpAction, ErpResource } from '@/v2/core/rbac-core';
import { AiHubGarageService } from '../ai-hub-garage.service';
import { CreatePrFromInvoiceDto } from '../dto/create-pr-from-invoice.dto';
import {
  assertInvoiceFile,
  INVOICE_UPLOAD_MAX_BYTES,
  invoiceUploadFilter,
} from '../helpers/invoice-upload.helper';

interface RequestWithUser {
  user?: { sub?: string };
}

const USE_AI = {
  resource: ErpResource.AI_HUB_GARAGE,
  action: ErpAction.CREATE,
};
const CREATE_REQUEST = {
  resource: ErpResource.GARAGE_PROCUREMENT_REQUESTS,
  action: ErpAction.CREATE,
};

@ApiTags('ai-hub-garage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('api/v2/ai-hub-garage')
export class AiHubGarageController {
  constructor(private readonly service: AiHubGarageService) {}

  @RequirePermissions(USE_AI)
  @ApiOperation({
    summary:
      'AI đọc ảnh/PDF hóa đơn và đối chiếu mã hàng. Chỉ xem trước, không ghi DB',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: INVOICE_UPLOAD_MAX_BYTES, files: 1 },
      fileFilter: invoiceUploadFilter,
    }),
  )
  @Post('invoice-preview')
  previewInvoice(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: RequestWithUser,
  ) {
    assertInvoiceFile(file);
    return this.service.previewInvoice(
      {
        buffer: file!.buffer,
        mimeType: file!.mimetype,
        fileName: file!.originalname,
      },
      req.user?.sub ?? '',
    );
  }

  // Cần cả quyền dùng trợ lý AI lẫn quyền tạo đề nghị mua garage
  @RequirePermissions(USE_AI, CREATE_REQUEST)
  @ApiOperation({
    summary:
      'Tạo đề nghị mua nháp từ các dòng đã xác nhận, tự tạo mã hàng còn thiếu',
  })
  @Post('purchase-requests')
  createPurchaseRequest(
    @Body() dto: CreatePrFromInvoiceDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.createPurchaseRequest(dto, req.user?.sub ?? '');
  }
}
