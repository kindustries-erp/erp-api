import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ErpGoodsReceipt } from '@/goods-receipts-core/entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from '@/goods-receipts-core/entities/erp_goods_receipt_line.entity';
import { ErpInvoice } from '@/erp-invoices-core/entities/erp_invoice.entity';
import { ErpBusinessPartner } from '@/v2/core/business-partners-core';
import { PURCHASE_ORDER_STATUS } from '@/v2/core/purchase-orders/contracts/purchase-order.contract';
import { PurchaseOrder } from '../entities/purchase-order.entity';

/**
 * Các chứng từ liên quan tới PO: phiếu nhập, hóa đơn, và liên kết hóa đơn.
 * Đọc từ bảng v1 (goods receipts, invoices) nhưng chỉ ghi cột purchase_order_id của hóa đơn.
 */
@Injectable()
export class PurchaseOrderLinksService {
  constructor(private readonly dataSource: DataSource) {}

  /** Phiếu nhập của PO, bỏ qua nháp và đã hủy. */
  async getReceipts(poId: string) {
    const receiptRepo = this.dataSource.getRepository(ErpGoodsReceipt);
    const lineRepo = this.dataSource.getRepository(ErpGoodsReceiptLine);
    const receipts = await receiptRepo.find({
      where: { purchaseOrderId: poId, isDeleted: false } as never,
      order: { receiptDate: 'ASC', createdAt: 'ASC' },
    });
    const visible = receipts.filter(
      (r) => r.status !== 'DRAFT' && r.status !== 'CANCELLED',
    );
    return Promise.all(
      visible.map(async (receipt) => {
        const lines = await lineRepo.find({
          where: { goodsReceiptId: receipt.id } as never,
          order: { lineNo: 'ASC' },
        });
        return {
          ...receipt,
          lines: lines.map((line) => ({
            ...line,
            qtyReceived: String(line.qtyReceived ?? 0),
            unitCost: line.unitCost == null ? null : String(line.unitCost),
            amount: line.amount == null ? null : String(line.amount),
          })),
        };
      }),
    );
  }

  /** Các chứng từ nối với PO: phiếu nhập, hóa đơn, và thông tin NCC. */
  async getConnections(poId: string) {
    const po = await this.dataSource.getRepository(PurchaseOrder).findOne({
      where: { id: poId, isDeleted: false },
    });
    if (!po) throw new NotFoundException('Không tìm thấy đơn mua hàng');

    const supplier = po.supplierId
      ? await this.dataSource
          .getRepository(ErpBusinessPartner)
          .findOne({ where: { id: po.supplierId } })
      : null;

    const goodsReceipts = await this.dataSource
      .getRepository(ErpGoodsReceipt)
      .find({
        where: { purchaseOrderId: poId, isDeleted: false } as never,
        order: { receiptDate: 'ASC' },
        select: ['id', 'receiptNo', 'receiptDate', 'status'],
      });
    const invoices = await this.dataSource.getRepository(ErpInvoice).find({
      where: { purchaseOrderId: poId, isDeleted: false } as never,
      select: [
        'id',
        'invoiceNo',
        'invoiceDate',
        'totalAmount',
        'status',
        'direction',
      ] as never,
    });

    return {
      purchaseOrder: {
        id: po.id,
        poNo: po.poNo,
        orderDate: po.orderDate,
        status: po.status,
        paymentStatus: po.paymentStatus,
        supplierId: po.supplierId,
        supplierName: supplier?.name ?? null,
        supplierCode: supplier?.code ?? null,
      },
      goodsReceipts,
      invoices,
    };
  }

  async getLinkedInvoices(poId: string) {
    return this.dataSource.getRepository(ErpInvoice).find({
      where: { purchaseOrderId: poId, isDeleted: false } as never,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Gắn hóa đơn vào PO (#6). Kiểm tra: PO tồn tại và không bị hủy; mọi hóa
   * đơn tồn tại, chưa xóa; không hóa đơn nào đang thuộc PO khác.
   * Ghi trong một transaction để không gắn dở.
   */
  async linkInvoices(poId: string, invoiceIds: string[]) {
    const ids = [...new Set(invoiceIds)];
    const po = await this.dataSource.getRepository(PurchaseOrder).findOne({
      where: { id: poId, isDeleted: false },
    });
    if (!po) throw new NotFoundException('Không tìm thấy đơn mua hàng');
    if (po.status === PURCHASE_ORDER_STATUS.CANCELLED) {
      throw new BadRequestException('Không liên kết hóa đơn vào đơn đã hủy');
    }

    await this.dataSource.transaction(async (manager) => {
      const invoices = await manager.find(ErpInvoice, {
        where: { id: In(ids), isDeleted: false } as never,
      });
      if (invoices.length !== ids.length) {
        throw new BadRequestException(
          'Có hóa đơn không tồn tại hoặc đã bị xóa',
        );
      }
      const taken = invoices.find(
        (invoice) =>
          invoice.purchaseOrderId && invoice.purchaseOrderId !== poId,
      );
      if (taken) {
        throw new ConflictException(
          `Hóa đơn ${taken.invoiceNo} đã liên kết với đơn mua hàng khác`,
        );
      }
      await manager.update(
        ErpInvoice,
        { id: In(ids) } as never,
        { purchaseOrderId: poId } as never,
      );
    });

    return {
      message: 'Liên kết hóa đơn thành công',
      data: { linked: ids.length },
    };
  }

  async unlinkInvoice(poId: string, invoiceId: string) {
    const result = await this.dataSource.getRepository(ErpInvoice).update(
      { id: invoiceId, purchaseOrderId: poId } as never,
      {
        purchaseOrderId: null,
      } as never,
    );
    if (!result.affected) {
      throw new NotFoundException('Hóa đơn không thuộc đơn mua hàng này');
    }
    return {
      message: 'Hủy liên kết hóa đơn thành công',
      data: { id: invoiceId },
    };
  }
}
