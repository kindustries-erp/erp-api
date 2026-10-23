import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import {
  InvoiceItemResponseDto,
  InvoiceResponseDto,
} from '../dto/invoice-response.dto';

/** Chuyển entity sang response DTO. Hàm thuần, không gọi DB. `items` chỉ có khi truyền vào. */
export function toInvoiceResponse(
  entity: Invoice,
  items?: InvoiceItem[],
): InvoiceResponseDto {
  return {
    id: entity.id,
    invoiceNo: entity.invoiceNo,
    invoiceNoNormalized: entity.invoiceNoNormalized ?? undefined,
    serialNo: entity.serialNo ?? undefined,
    invoiceDate: entity.invoiceDate,
    direction: entity.direction,
    status: entity.status ?? undefined,
    taxInvoiceStatus: entity.taxInvoiceStatus ?? undefined,
    taxProcessStatus: entity.taxProcessStatus ?? undefined,
    sellerName: entity.sellerName ?? undefined,
    sellerTaxCode: entity.sellerTaxCode ?? undefined,
    sellerAddress: entity.sellerAddress ?? undefined,
    sellerBank: entity.sellerBank ?? undefined,
    buyerName: entity.buyerName ?? undefined,
    buyerPersonalName: entity.buyerPersonalName ?? undefined,
    buyerTaxCode: entity.buyerTaxCode ?? undefined,
    buyerCccd: entity.buyerCccd ?? undefined,
    buyerAddress: entity.buyerAddress ?? undefined,
    description: entity.description ?? undefined,
    invoiceType: entity.invoiceType ?? undefined,
    invoiceCategory: entity.invoiceCategory ?? undefined,
    preVatAmount: toNumber(entity.preVatAmount),
    vatRate: toNumber(entity.vatRate),
    vatAmount: toNumber(entity.vatAmount),
    discountAmount: toNumber(entity.discountAmount),
    totalAmount: toNumber(entity.totalAmount),
    purchaseOrderId: entity.purchaseOrderId ?? undefined,
    salesOrderId: entity.salesOrderId ?? undefined,
    paymentDocumentNos: entity.paymentDocumentNos ?? undefined,
    notes: entity.notes ?? undefined,
    settlementOrder: entity.settlementOrder ?? undefined,
    licensePlate: entity.licensePlate ?? undefined,
    relatedInvoiceNo: entity.relatedInvoiceNo ?? undefined,
    relatedSerialNo: entity.relatedSerialNo ?? undefined,
    branchIds: entity.branchIds ?? [],
    categoryId: entity.categoryId ?? undefined,
    isValid: entity.isValid,
    postingStatus: entity.postingStatus,
    createdBy: entity.createdBy ?? undefined,
    pdfFileKey: entity.pdfFileKey ?? undefined,
    xmlFileKey: entity.xmlFileKey ?? undefined,
    effectiveData: entity.effectiveData ?? undefined,
    items: items?.map(toInvoiceItemResponse),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}

export function toInvoiceItemResponse(
  item: InvoiceItem,
): InvoiceItemResponseDto {
  return {
    id: item.id,
    invoiceSubcategory: item.invoiceSubcategory,
    description: item.description ?? undefined,
    unit: item.unit ?? undefined,
    itemCode: item.itemCode ?? undefined,
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    preVatAmount: Number(item.preVatAmount),
    vatRate: toNumber(item.vatRate),
    vatAmount: Number(item.vatAmount),
    discountAmount: Number(item.discountAmount),
    totalAmount: Number(item.totalAmount),
  };
}

/**
 * Chuyển dữ liệu DTO sang dạng ghi vào entity (chỉ cột của hóa đơn).
 * Chi nhánh, items và số hóa đơn chuẩn hóa do command service xử lý.
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
    taxInvoiceStatus: dto.taxInvoiceStatus,
    taxProcessStatus: dto.taxProcessStatus,
    isValid: dto.isValid,
    categoryId: dto.categoryId,
    sellerName: dto.sellerName,
    sellerTaxCode: dto.sellerTaxCode,
    sellerAddress: dto.sellerAddress,
    sellerBank: dto.sellerBank,
    buyerName: dto.buyerName,
    buyerPersonalName: dto.buyerPersonalName,
    buyerTaxCode: dto.buyerTaxCode,
    buyerCccd: dto.buyerCccd,
    buyerAddress: dto.buyerAddress,
    description: dto.description,
    invoiceType: dto.invoiceType,
    invoiceCategory: dto.invoiceCategory,
    preVatAmount: toDecimalString(dto.preVatAmount),
    vatRate: toDecimalString(dto.vatRate),
    vatAmount: toDecimalString(dto.vatAmount),
    discountAmount: toDecimalString(dto.discountAmount),
    totalAmount: toDecimalString(dto.totalAmount),
    purchaseOrderId: dto.purchaseOrderId,
    salesOrderId: dto.salesOrderId,
    paymentDocumentNos: dto.paymentDocumentNos,
    notes: dto.notes,
    settlementOrder: dto.settlementOrder,
    licensePlate: dto.licensePlate,
    relatedInvoiceNo: dto.relatedInvoiceNo,
    relatedSerialNo: dto.relatedSerialNo,
  });
}

function toNumber(
  value: string | number | null | undefined,
): number | undefined {
  return value == null ? undefined : Number(value);
}

function toDecimalString(value: number | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}
