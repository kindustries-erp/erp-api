import { Inject, Injectable } from '@nestjs/common';
import { AiDocumentFile } from '@/v2/core/ai-hub-core';
import { GARAGE_ITEM_CATALOG } from '@/v2/modules/items-garage/items-garage.tokens';
import type { GarageItemCatalog } from '@/v2/modules/items-garage/items-garage.tokens';
import { CreatePrFromInvoiceDto } from './dto/create-pr-from-invoice.dto';
import { InvoicePreviewResponseDto } from './dto/invoice-preview-response.dto';
import { PrFromInvoiceResponseDto } from './dto/pr-from-invoice-response.dto';
import { toInvoicePreview } from './helpers/invoice-preview.mapper';
import { GarageInvoiceExtractService } from './services/garage-invoice-extract.service';
import { GaragePrFromInvoiceService } from './services/garage-pr-from-invoice.service';

/** Facade trợ lý hóa đơn của garage: xem trước (không ghi DB) rồi tạo đề nghị mua khi xác nhận. */
@Injectable()
export class AiHubGarageService {
  constructor(
    private readonly extractor: GarageInvoiceExtractService,
    @Inject(GARAGE_ITEM_CATALOG)
    private readonly items: GarageItemCatalog,
    private readonly prFromInvoice: GaragePrFromInvoiceService,
  ) {}

  /** Đọc hóa đơn bằng AI và đối chiếu từng dòng với danh mục mã hàng. Không ghi DB. */
  async previewInvoice(
    file: AiDocumentFile,
    actorId: string,
  ): Promise<InvoicePreviewResponseDto> {
    const extraction = await this.extractor.extract(file, {
      actorUserId: actorId || undefined,
    });
    const matches = await this.items.match(extraction.data.lines);
    return toInvoicePreview(extraction, matches);
  }

  createPurchaseRequest(
    dto: CreatePrFromInvoiceDto,
    actorId: string,
  ): Promise<PrFromInvoiceResponseDto> {
    return this.prFromInvoice.create(dto, actorId);
  }
}
