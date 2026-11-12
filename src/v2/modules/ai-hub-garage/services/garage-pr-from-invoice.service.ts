import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GarageItemMatchService } from '@/v2/modules/items-garage/services/garage-item-match.service';
import { GarageProcurementRequestCommandService } from '@/v2/modules/procurement-requests-garage/services/procurement-request-command.service';
import { CreatePrFromInvoiceDto } from '../dto/create-pr-from-invoice.dto';
import { PrFromInvoiceResponseDto } from '../dto/pr-from-invoice-response.dto';
import { lineTypeOf } from '../helpers/garage-invoice-extraction.helper';

/**
 * Tạo đề nghị mua nháp từ các dòng hóa đơn người dùng đã xác nhận.
 * Mã hàng thiếu và phiếu được ghi trong một transaction: lỗi ở bước nào cũng hoàn tác cả hai.
 */
@Injectable()
export class GaragePrFromInvoiceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly items: GarageItemMatchService,
    private readonly requests: GarageProcurementRequestCommandService,
  ) {}

  create(
    dto: CreatePrFromInvoiceDto,
    actorId: string,
  ): Promise<PrFromInvoiceResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      // Tra lại danh mục trong transaction: không dựa vào kết quả khớp do client gửi
      const { items, created } = await this.items.ensureItems(
        dto.lines,
        manager,
      );
      // Biến riêng vì chi nhánh là trường của entity garage, nằm ngoài kiểu header chung của lõi
      const header = {
        branchId: dto.branchId,
        branchName: dto.branchName,
        requestDate: dto.requestDate,
        title:
          dto.title?.trim() ||
          (dto.invoiceNo
            ? `Đề nghị mua theo hóa đơn ${dto.invoiceNo}`
            : 'Đề nghị mua theo hóa đơn'),
        remarks: dto.remarks,
        extraData: {
          source: 'AI_INVOICE',
          ...(dto.invoiceNo ? { invoiceNo: dto.invoiceNo } : {}),
          ...(dto.sellerName ? { sellerName: dto.sellerName } : {}),
        },
      };
      const request = await this.requests.createDraft(
        { id: actorId, roles: [] },
        header,
        dto.lines.map((line, index) => ({
          lineType: lineTypeOf(items[index].itemType ?? line.itemType),
          itemId: items[index].id,
          itemCode: items[index].itemCode,
          itemName: line.itemName.trim(),
          qtyRequested: line.qtyRequested,
          estUnitPrice: line.estUnitPrice ?? null,
          extraData: line.unit ? { unit: line.unit.trim() } : {},
        })),
        manager,
      );
      return {
        requestId: request.id,
        requestNo: request.requestNo,
        createdItems: created.map((item) => ({
          id: item.id,
          itemCode: item.itemCode,
          itemName: item.itemName,
        })),
      };
    });
  }
}
