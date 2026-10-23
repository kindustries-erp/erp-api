import { Invoice } from '../entities/invoice.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { InvoiceResponseDto } from '../dto/invoice-response.dto';

/** Chuyển entity sang response DTO. Hàm thuần, không gọi DB. */
export function toInvoiceResponse(entity: Invoice): InvoiceResponseDto {
  return {
    id: entity.id,
    invoiceNo: entity.invoiceNo,
    serialNo: entity.serialNo ?? undefined,
    invoiceDate: entity.invoiceDate,
    direction: entity.direction,
    status: entity.status ?? undefined,
    sellerName: entity.sellerName ?? undefined,
    sellerTaxCode: entity.sellerTaxCode ?? undefined,
    buyerName: entity.buyerName ?? undefined,
    buyerTaxCode: entity.buyerTaxCode ?? undefined,
    description: entity.description ?? undefined,
    invoiceType: entity.invoiceType ?? undefined,
    invoiceCategory: entity.invoiceCategory ?? undefined,
    preVatAmount:
      entity.preVatAmount == null ? undefined : Number(entity.preVatAmount),
    vatRate: entity.vatRate == null ? undefined : Number(entity.vatRate),
    vatAmount: entity.vatAmount == null ? undefined : Number(entity.vatAmount),
    discountAmount:
      entity.discountAmount == null ? undefined : Number(entity.discountAmount),
    totalAmount:
      entity.totalAmount == null ? undefined : Number(entity.totalAmount),
    notes: entity.notes ?? undefined,
    branchIds: entity.branchIds ?? [],
    categoryId: entity.categoryId ?? undefined,
    isValid: entity.isValid,
    postingStatus: entity.postingStatus,
    pdfFileKey: entity.pdfFileKey ?? undefined,
    xmlFileKey: entity.xmlFileKey ?? undefined,
    effectiveData: entity.effectiveData ?? undefined,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

/**
 * Chuyển dữ liệu DTO sang dạng ghi vào entity.
 * Bỏ các key `undefined` để cập nhật một phần không ghi đè giá trị cũ.
 */
export function toInvoiceEntityFields(
  dto: Partial<CreateInvoiceDto>,
): Partial<Invoice> {
  return omitUndefined<Partial<Invoice>>({
    invoiceNo: dto.invoiceNo,
    serialNo: dto.serialNo,
    invoiceDate: dto.invoiceDate,
    direction: dto.direction,
    status: dto.status,
    sellerName: dto.sellerName,
    sellerTaxCode: dto.sellerTaxCode,
    buyerName: dto.buyerName,
    buyerTaxCode: dto.buyerTaxCode,
    description: dto.description,
    invoiceType: dto.invoiceType,
    invoiceCategory: dto.invoiceCategory,
    preVatAmount:
      dto.preVatAmount === undefined ? undefined : String(dto.preVatAmount),
    vatRate: dto.vatRate === undefined ? undefined : String(dto.vatRate),
    vatAmount: dto.vatAmount === undefined ? undefined : String(dto.vatAmount),
    discountAmount:
      dto.discountAmount === undefined ? undefined : String(dto.discountAmount),
    totalAmount:
      dto.totalAmount === undefined ? undefined : String(dto.totalAmount),
    notes: dto.notes,
  });
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}
