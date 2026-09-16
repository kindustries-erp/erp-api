import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, In, Like } from 'typeorm';
import { format } from 'date-fns';
import { ErpInventoryTrackingSerial } from '../entities/erp_inventory_tracking_serial.entity';
import { ErpInventoryItem } from '../entities/erp_inventory_item.entity';

export interface GenerateSystemSerialsParams {
  item: ErpInventoryItem;
  qty: number;
  receiptLineId?: string | null;
  receiptId?: string | null;
  unitCost?: number | string | null;
  receiptDate?: string | Date | null;
  userDeclaredSerials?: Array<{
    serialNo: string;
    vinNo?: string | null;
    engineNo?: string | null;
    internalSerialNo?: string | null;
    lotNo?: string | null;
    notes?: string | null;
    attributes?: Record<string, any> | null;
  }> | null;
}

export interface DeductFifoSystemSerialsParams {
  itemId: string;
  qty: number;
  goodsIssueLineId?: string | null;
  salesOrderLineId?: string | null;
  productionOrderId?: string | null;
  vehicleId?: string | null;
}

@Injectable()
export class InventorySystemSerialService {
  private readonly logger = new Logger(InventorySystemSerialService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Tự động sinh hàng loạt mã System Serial ngầm cho một dòng hàng nhập kho
   * Format: SYS-{SKU}-{YYMMDD}-{000001...}
   */
  async generateSystemSerials(
    manager: EntityManager,
    params: GenerateSystemSerialsParams,
  ): Promise<ErpInventoryTrackingSerial[]> {
    const {
      item,
      qty,
      receiptLineId,
      receiptId,
      unitCost,
      receiptDate,
      userDeclaredSerials,
    } = params;

    const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
    const dateObj = receiptDate ? new Date(receiptDate) : new Date();
    const dateStr = format(dateObj, 'yyMMdd');
    const cleanSku = (item.sku || 'ITEM').replace(/[^a-zA-Z0-9_-]/g, '');
    const prefix = `SYS-${cleanSku}-${dateStr}-`;

    const roundedQty = Math.max(0, Math.round(Number(qty || 0)));
    if (roundedQty <= 0) return [];

    // Tìm sequence lớn nhất có cùng prefix trong ngày để tăng dần
    const lastRecord = await serialRepo.findOne({
      where: { systemSerialNo: Like(`${prefix}%`) },
      order: { systemSerialNo: 'DESC' },
    });

    let lastSeq = 0;
    if (lastRecord?.systemSerialNo) {
      const suffix = lastRecord.systemSerialNo.slice(prefix.length);
      const parsed = parseInt(suffix, 10);
      if (!isNaN(parsed)) lastSeq = parsed;
    }

    const hasDeclared =
      Array.isArray(userDeclaredSerials) && userDeclaredSerials.length > 0;

    const serialsToInsert: Partial<ErpInventoryTrackingSerial>[] = [];

    for (let i = 1; i <= roundedQty; i++) {
      const systemSerialNo = `${prefix}${String(lastSeq + i).padStart(6, '0')}`;
      const declared = hasDeclared ? userDeclaredSerials[i - 1] : null;

      const userSerial = declared?.serialNo?.trim();
      const actualSerialNo = userSerial || systemSerialNo;
      const trackingType = userSerial ? 'USER_DECLARED' : 'SYSTEM_AUTO';

      const finalAttributes: Record<string, any> = {
        ...(declared?.attributes || {}),
        ...(declared?.vinNo ? { vinNo: declared.vinNo } : {}),
        ...(declared?.engineNo ? { engineNo: declared.engineNo } : {}),
        ...(declared?.internalSerialNo
          ? { internalSerialNo: declared.internalSerialNo }
          : {}),
      };

      serialsToInsert.push({
        itemId: item.id,
        serialNo: actualSerialNo,
        systemSerialNo,
        trackingType,
        status: 'IN_STOCK',
        vinId: null,
        customId: null,
        receiptLineId: receiptLineId || null,
        salesOrderLineId: null,
        goodsIssueLineId: null,
        productionOrderId: null,
        lotNo: declared?.lotNo || null,
        notes: declared?.notes || null,
        unitCost:
          unitCost !== undefined && unitCost !== null ? String(unitCost) : null,
        sourceDocumentType: 'GOODS_RECEIPT',
        sourceDocumentId: receiptId || null,
        attributes:
          Object.keys(finalAttributes).length > 0 ? finalAttributes : null,
      });
    }

    // Bulk insert theo từng chunk 2.000 bản ghi để tối ưu tốc độ và bộ nhớ
    const chunkSize = 2000;
    for (let j = 0; j < serialsToInsert.length; j += chunkSize) {
      await serialRepo.insert(serialsToInsert.slice(j, j + chunkSize));
    }

    this.logger.log(
      `Generated ${roundedQty} system serials for item ${item.sku} [${prefix}${String(lastSeq + 1).padStart(6, '0')} → ${prefix}${String(lastSeq + roundedQty).padStart(6, '0')}] (Type: ${hasDeclared ? 'USER_DECLARED' : 'SYSTEM_AUTO'})`,
    );

    return serialsToInsert as ErpInventoryTrackingSerial[];
  }

  /**
   * Tự động khấu trừ System Serial theo nguyên tắc FIFO (Nhập trước xuất trước)
   */
  async deductFifoSystemSerials(
    manager: EntityManager,
    params: DeductFifoSystemSerialsParams,
  ): Promise<number> {
    const {
      itemId,
      qty,
      goodsIssueLineId,
      salesOrderLineId,
      productionOrderId,
      vehicleId,
    } = params;

    const roundedQty = Math.max(0, Math.round(Number(qty || 0)));
    if (roundedQty <= 0) return 0;

    const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);

    // Lấy đúng số lượng serial nhập sớm nhất đang IN_STOCK
    const candidates = await serialRepo.find({
      where: {
        itemId,
        status: 'IN_STOCK',
      },
      order: {
        createdAt: 'ASC',
      },
      take: roundedQty,
    });

    if (candidates.length === 0) return 0;

    const nextStatus = goodsIssueLineId
      ? 'ISSUED'
      : productionOrderId
        ? 'ASSEMBLED'
        : 'USED';

    const candidateIds = candidates.map((c) => c.id);

    // Bulk update trạng thái
    const updatePayload: Partial<ErpInventoryTrackingSerial> = {
      status: nextStatus,
    };
    if (goodsIssueLineId) updatePayload.goodsIssueLineId = goodsIssueLineId;
    if (salesOrderLineId) updatePayload.salesOrderLineId = salesOrderLineId;
    if (productionOrderId) updatePayload.productionOrderId = productionOrderId;
    if (vehicleId) updatePayload.vinId = vehicleId;

    await serialRepo.update({ id: In(candidateIds) }, updatePayload);

    this.logger.log(
      `Auto-FIFO deducted ${candidates.length}/${roundedQty} system serials for item ${itemId} -> status=${nextStatus}`,
    );

    return candidates.length;
  }

  /**
   * Hoàn đảo (revert) các System Serials khi hủy phiếu xuất hoặc hủy lệnh sản xuất
   */
  async revertDeductedSystemSerials(
    manager: EntityManager,
    filter: {
      goodsIssueLineId?: string;
      productionOrderId?: string;
      salesOrderLineId?: string;
    },
  ): Promise<number> {
    const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);

    const where: any = {};
    if (filter.goodsIssueLineId)
      where.goodsIssueLineId = filter.goodsIssueLineId;
    if (filter.productionOrderId)
      where.productionOrderId = filter.productionOrderId;
    if (filter.salesOrderLineId)
      where.salesOrderLineId = filter.salesOrderLineId;

    if (Object.keys(where).length === 0) return 0;

    const result = await serialRepo.update(where, {
      status: 'IN_STOCK',
      goodsIssueLineId: null,
      productionOrderId: null,
      salesOrderLineId: null,
      vinId: null,
    });

    this.logger.log(
      `Reverted ${result.affected || 0} system serials back to IN_STOCK`,
    );
    return result.affected || 0;
  }
}
