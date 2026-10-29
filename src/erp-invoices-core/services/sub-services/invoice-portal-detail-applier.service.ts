import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpInvoiceItem } from '../../entities/erp_invoice_item.entity';
import {
  buildMetadataFillPatch,
  buildPortalHeaderPatch,
  matchPortalItems,
  PortalOwnedItemField,
  PortalOwnedPatch,
} from '../../helpers/portal-detail-merge.helper';

export interface PortalDetailItem {
  description?: string | null;
  itemCode?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  preVatAmount?: number | null;
  vatRate?: number | null;
  vatAmount?: number | null;
  discountAmount?: number | null;
  totalAmount?: number | null;
}

export interface PortalDetailPayload {
  /** Header lấy từ JSON chi tiết GDT; chỉ các field GDT-owned được áp. */
  header: object;
  items: PortalDetailItem[];
}

export interface ApplyPortalDetailResult {
  changed: boolean;
}

/** Số thực gửi vào cột numeric/int: chuyển về chuỗi như lifecycle đang làm. */
function toColumnValue(value: unknown): unknown {
  return typeof value === 'number' ? String(value) : value;
}

function toColumnPatch<TField extends string>(
  patch: PortalOwnedPatch<TField>,
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch)) {
    columns[field] = toColumnValue(value);
  }
  return columns;
}

/**
 * Áp dữ liệu chi tiết từ GDT vào hóa đơn mà không ghi đè dữ liệu ERP tự quản.
 * Thay vì xóa toàn bộ dòng hàng rồi tạo lại (làm mất id, itemCode, ledger VinFast),
 * dòng khớp được cập nhật tại chỗ; chỉ thêm/xóa phần chênh lệch.
 */
@Injectable()
export class InvoicePortalDetailApplier {
  constructor(private readonly dataSource: DataSource) {}

  async applyPortalDetail(
    invoiceId: string,
    payload: PortalDetailPayload,
  ): Promise<ApplyPortalDetailResult> {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager.findOne(ErpInvoice, {
        where: { id: invoiceId, isDeleted: false },
        relations: ['items'],
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} không tìm thấy`);
      }

      const headerPatch = buildPortalHeaderPatch(invoice, payload.header);
      const itemMatch = matchPortalItems(invoice.items ?? [], payload.items);

      const description =
        typeof headerPatch.description === 'string'
          ? headerPatch.description
          : invoice.description;
      const metadataPatch = buildMetadataFillPatch(
        {
          description,
          notes: invoice.notes,
          settlementOrder: invoice.settlementOrder,
          licensePlate: invoice.licensePlate,
        },
        payload.items,
      );

      const invoiceColumns = {
        ...toColumnPatch(headerPatch),
        ...metadataPatch,
      };
      const hasInvoiceChange = Object.keys(invoiceColumns).length > 0;
      const hasItemChange =
        itemMatch.updates.length > 0 ||
        itemMatch.inserts.length > 0 ||
        itemMatch.deletes.length > 0;

      if (!hasInvoiceChange && !hasItemChange) {
        return { changed: false };
      }

      if (itemMatch.deletes.length > 0) {
        await manager.delete(ErpInvoiceItem, { id: In(itemMatch.deletes) });
      }

      for (const update of itemMatch.updates) {
        await manager.update(
          ErpInvoiceItem,
          { id: update.id },
          toColumnPatch<PortalOwnedItemField>(
            update.patch,
          ) as QueryDeepPartialEntity<ErpInvoiceItem>,
        );
      }

      if (itemMatch.inserts.length > 0) {
        const rows = itemMatch.inserts.map((item) =>
          manager.create(ErpInvoiceItem, {
            invoiceId,
            itemCode: item.itemCode ?? null,
            description: item.description ?? null,
            unit: item.unit ?? null,
            quantity: item.quantity != null ? String(item.quantity) : null,
            unitPrice: item.unitPrice != null ? String(item.unitPrice) : null,
            preVatAmount: String(item.preVatAmount ?? 0),
            vatRate: item.vatRate != null ? String(item.vatRate) : null,
            vatAmount: String(item.vatAmount ?? 0),
            discountAmount: String(item.discountAmount ?? 0),
            totalAmount: String(item.totalAmount ?? 0),
          }),
        );
        await manager.save(ErpInvoiceItem, rows);
      }

      if (hasInvoiceChange) {
        await manager.update(
          ErpInvoice,
          { id: invoiceId },
          invoiceColumns as QueryDeepPartialEntity<ErpInvoice>,
        );
      }

      return { changed: true };
    });
  }
}
