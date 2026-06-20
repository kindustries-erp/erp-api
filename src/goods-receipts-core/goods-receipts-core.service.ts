import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Repository, In } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpGoodsReceipt } from './entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from './entities/erp_goods_receipt_line.entity';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptDto } from './dto/update-goods-receipt.dto';
import { PostGoodsReceiptDto } from './dto/post-goods-receipt.dto';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpPurchaseOrder } from '../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from '../purchase-orders-core/entities/erp_purchase_order_line.entity';
import { ErpBusinessPartner } from '../business-partners-core/entities/erp_business_partner.entity';
import { ErpProductionOrder } from '../production-core/entities/erp_production_order.entity';
import { ErpProductionOrderMaterial } from '../production-core/entities/erp_production_order_material.entity';
import { DocumentDependenciesCoreService } from '../document-dependencies-core/document-dependencies-core.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class GoodsReceiptsCoreService {
  private readonly logger = new Logger(GoodsReceiptsCoreService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpGoodsReceipt)
    private readonly repository: Repository<ErpGoodsReceipt>,
    @InjectRepository(ErpGoodsReceiptLine)
    private readonly lineRepository: Repository<ErpGoodsReceiptLine>,
    private readonly dependencyService: DocumentDependenciesCoreService,
  ) {}

  private async generateMonthlyReceiptNo(manager: any, receiptDate?: string) {
    const baseDate = receiptDate ? new Date(receiptDate) : new Date();
    const year = baseDate.getUTCFullYear();
    const month = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const prefix = `NK-${year}${month}`;
    const latest = await manager
      .getRepository(ErpGoodsReceipt)
      .createQueryBuilder('gr')
      .where('gr.receiptNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('gr.receiptNo', 'DESC')
      .getOne();
    const latestSeq = latest?.receiptNo?.slice(prefix.length) ?? '000';
    const nextSeq = String(Number(latestSeq || '0') + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  private async getReceiptOrThrow(
    repository: Repository<ErpGoodsReceipt>,
    id: string,
  ) {
    const receipt = await repository.findOneBy({ id, isDeleted: false });
    if (!receipt) {
      throw new NotFoundException('Không tìm thấy phiếu nhập');
    }
    return receipt;
  }

  async getNextReceiptNo(date?: string): Promise<{ nextNo: string }> {
    const nextNo = await this.dataSource.transaction((manager) =>
      this.generateMonthlyReceiptNo(manager, date),
    );
    return { nextNo };
  }

  async create(dto: CreateGoodsReceiptDto) {
    const { lines = [], ...header } = dto;
    return this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(ErpGoodsReceipt);
      const lineRepo = manager.getRepository(ErpGoodsReceiptLine);
      const receiptNo =
        header.receiptNo?.trim() ||
        (await this.generateMonthlyReceiptNo(manager, header.receiptDate));
      const headerPayload: DeepPartial<ErpGoodsReceipt> = {
        ...header,
        receiptNo,
        status: 'DRAFT',
      };
      const data = await headerRepo.save(headerPayload);
      const savedLines: ErpGoodsReceiptLine[] = [];
      let lineNo = 1;
      for (const line of lines) {
        const linePayload: DeepPartial<ErpGoodsReceiptLine> = {
          goodsReceiptId: data.id,
          lineNo: lineNo++,
          purchaseOrderLineId: line.purchaseOrderLineId ?? null,
          itemId: line.itemId ?? null,
          qtyReceived: line.qtyReceived,
          unitCost: line.unitCost ?? null,
          amount: line.amount ?? null,
        };
        const saved = await lineRepo.save(linePayload);
        savedLines.push(saved);
      }
      return {
        message: 'Tạo thành công',
        data: { ...data, lines: savedLines },
      };
    });
  }

  async findAll(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const order = resolveSortOrder(query.sort, {
      allowedFields: ['createdAt', 'receiptDate', 'receiptNo', 'status'],
      columnMap: { created_at: 'createdAt', receipt_date: 'receiptDate' },
      defaultOrder: { createdAt: 'DESC' },
    });
    const where = query.search
      ? ([{ receiptNo: ILike(`%${query.search}%`), isDeleted: false }] as any)
      : ({ isDeleted: false } as any);
    const [items, total] = await this.repository.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });
    const supplierIds = [
      ...new Set(items.map((i) => i.supplierId).filter(Boolean)),
    ] as string[];
    let supplierMap = new Map<string, string>();
    if (supplierIds.length > 0) {
      const bpRepo = this.dataSource.getRepository(ErpBusinessPartner);
      const suppliers = await bpRepo.findBy({ id: In(supplierIds) });
      supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
    }

    const enrichedItems = items.map((item) => ({
      ...item,
      supplierName: item.supplierId
        ? supplierMap.get(item.supplierId) || null
        : null,
    }));

    return {
      items: enrichedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.getReceiptOrThrow(this.repository, id);
    let supplierName: string | null = null;
    if (data.supplierId) {
      const bpRepo = this.dataSource.getRepository(ErpBusinessPartner);
      const supplier = await bpRepo.findOneBy({ id: data.supplierId });
      supplierName = supplier?.name || null;
    }
    const lines = await this.lineRepository.find({
      where: { goodsReceiptId: id },
      order: { lineNo: 'ASC' },
    });
    return {
      message: 'Lấy thông tin thành công',
      data: { ...data, supplierName, lines },
    };
  }

  async update(id: string, dto: UpdateGoodsReceiptDto) {
    const existing = await this.getReceiptOrThrow(this.repository, id);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ được sửa phiếu nhập ở trạng thái nháp',
      );
    }

    const { lines, ...header } = dto as any;
    if (header.receiptNo === '') {
      delete header.receiptNo;
    }
    const updatePayload = { ...header, status: 'DRAFT' };
    await this.repository.update(id, updatePayload);
    if (Array.isArray(lines)) {
      await this.dataSource.transaction(async (manager) => {
        const lineRepo = manager.getRepository(ErpGoodsReceiptLine);
        await lineRepo.delete({ goodsReceiptId: id });
        let lineNo = 1;
        for (const line of lines) {
          const linePayload: DeepPartial<ErpGoodsReceiptLine> = {
            goodsReceiptId: id,
            lineNo: lineNo++,
            purchaseOrderLineId: line.purchaseOrderLineId ?? null,
            itemId: line.itemId ?? null,
            qtyReceived: line.qtyReceived,
            unitCost: line.unitCost ?? null,
            amount: line.amount ?? null,
          };
          await lineRepo.save(linePayload);
        }
      });
    }
    return this.findOne(id);
  }

  async postReceipt(id: string, dto: PostGoodsReceiptDto) {
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(ErpGoodsReceipt);
      const lineRepo = manager.getRepository(ErpGoodsReceiptLine);
      const txnRepo = manager.getRepository(ErpInventoryTransaction);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const poRepo = manager.getRepository(ErpPurchaseOrder);
      const poLineRepo = manager.getRepository(ErpPurchaseOrderLine);
      const moRepo = manager.getRepository(ErpProductionOrder);
      const moMatRepo = manager.getRepository(ErpProductionOrderMaterial);

      const receipt = await this.getReceiptOrThrow(receiptRepo, id);
      if (receipt.status === 'POSTED') {
        throw new BadRequestException('Phiếu nhập đã được ghi nhận trước đó');
      }

      const lines = await lineRepo.find({
        where: { goodsReceiptId: id },
        order: { lineNo: 'ASC' },
      });
      if (lines.length === 0) {
        throw new BadRequestException('Chưa nhập hàng nhập kho');
      }

      if (receipt.productionOrderId) {
        const mo = await moRepo.findOneBy({ id: receipt.productionOrderId });
        if (!mo || mo.isDeleted) {
          throw new BadRequestException(
            'Không tìm thấy lệnh sản xuất liên kết',
          );
        }
        const moMaterials = await moMatRepo.find({
          where: { productionOrderId: receipt.productionOrderId },
        });
        const incompleteMaterial = moMaterials.find((material) => {
          const qtyRequired = Number(material.qtyRequired || 0);
          const qtyIssued = Number(material.qtyIssued || 0);
          return qtyRequired > 0 && qtyIssued + 0.0005 < qtyRequired;
        });
        if (incompleteMaterial) {
          throw new BadRequestException(
            'Chưa xuất đủ nguyên vật liệu cho lệnh sản xuất, không thể nhập thành phẩm',
          );
        }
      }

      for (const line of lines) {
        const qty = Number(line.qtyReceived || 0);
        if (qty <= 0) {
          throw new BadRequestException(
            `Dòng ${line.lineNo} có số lượng nhận không hợp lệ`,
          );
        }

        const incomingUnitCost = Number(line.unitCost || 0);
        const balanceWhere: any = {
          itemId: line.itemId ?? undefined,
          warehouseCode: dto.warehouseCode ?? undefined,
        };
        let balance = (await balanceRepo.findOne({
          where: balanceWhere,
        })) as ErpInventoryBalance | null;
        const currentQty = Number(balance?.qtyOnHand || 0);
        const currentValue = Number(balance?.inventoryValue || 0);
        const receiptValue = qty * incomingUnitCost;
        const nextQty = currentQty + qty;
        const nextValue = currentValue + receiptValue;
        const nextAvgUnitCost = nextQty > 0 ? nextValue / nextQty : 0;

        await txnRepo.save(
          txnRepo.create({
            transactionType: 'RECEIPT',
            documentType: 'GOODS_RECEIPT',
            documentId: receipt.id,
            itemId: line.itemId ?? null,
            warehouseCode: dto.warehouseCode ?? null,
            qtyIn: qty.toFixed(3),
            qtyOut: '0.000',
            unitCost: incomingUnitCost.toFixed(3),
            transactionDate: receipt.receiptDate,
            notes: receipt.remarks ?? null,
            createdBy: dto.createdBy ?? receipt.createdBy ?? null,
          } as any),
        );

        if (!balance) {
          const balancePayload: DeepPartial<ErpInventoryBalance> = {
            itemId: line.itemId ?? null,
            warehouseCode: dto.warehouseCode ?? null,
            qtyOnHand: nextQty.toFixed(3),
            avgUnitCost: nextAvgUnitCost.toFixed(3),
            inventoryValue: nextValue.toFixed(3),
          };
          balance = await balanceRepo.save(balancePayload);
        } else {
          balance.qtyOnHand = nextQty.toFixed(3);
          balance.avgUnitCost = nextAvgUnitCost.toFixed(3);
          balance.inventoryValue = nextValue.toFixed(3);
          balance = await balanceRepo.save(balance);
        }

        if (line.purchaseOrderLineId) {
          const poLine = await poLineRepo.findOneBy({
            id: line.purchaseOrderLineId,
          });
          if (!poLine) {
            throw new BadRequestException(
              `Không tìm thấy dòng PO tham chiếu cho dòng nhập ${line.lineNo}`,
            );
          }
          const currentReceived = Number(poLine.qtyReceived || 0);
          const maxAllowed = Number(poLine.qtyOrdered || 0) - currentReceived;
          if (qty > maxAllowed + 0.0005) {
            throw new BadRequestException(
              `Dòng ${line.lineNo}: số lượng nhập (${qty}) vượt quá số lượng còn được nhận (${maxAllowed.toFixed(3)}) của PO`,
            );
          }
          poLine.qtyReceived = (currentReceived + qty).toFixed(3);
          await poLineRepo.save(poLine);
        }
      }

      if (receipt.purchaseOrderId) {
        const po = await poRepo.findOneBy({ id: receipt.purchaseOrderId });
        if (po) {
          const refreshedLines = await poLineRepo.find({
            where: { purchaseOrderId: po.id },
          });
          const allReceived =
            refreshedLines.length > 0 &&
            refreshedLines.every(
              (line) =>
                Number(line.qtyReceived || 0) >= Number(line.qtyOrdered || 0),
            );
          po.status = allReceived ? 'RECEIVED' : 'PARTIAL_RECEIVED';
          await poRepo.save(po);
        }
      }

      if (receipt.productionOrderId) {
        const mo = await moRepo.findOneBy({ id: receipt.productionOrderId });
        if (mo) {
          // Calculate total received qty across all receipt lines for this MO
          const totalReceived = lines.reduce(
            (sum, l) => sum + Number(l.qtyReceived || 0),
            0,
          );
          mo.qtyProduced = (
            Number(mo.qtyProduced || 0) + totalReceived
          ).toFixed(3);
          if (Number(mo.qtyProduced) >= Number(mo.qtyToProduce || 0)) {
            mo.status = 'COMPLETED';
          } else if (Number(mo.qtyProduced) > 0) {
            mo.status = 'IN_PROGRESS';
          }
          await moRepo.save(mo);
        }
      }

      receipt.status = 'POSTED';
      const savedReceipt = await receiptRepo.save(receipt);
      const savedLines = await lineRepo.find({
        where: { goodsReceiptId: id },
        order: { lineNo: 'ASC' },
      });

      // --- Journal entry generation removed (accounting module decoupled) ---
      this.logger.log(
        `Goods receipt ${savedReceipt.receiptNo} posted; journal entry generation skipped.`,
      );
      // -----------------------------------------------------------------------

      return {
        message: 'Lấy thông tin thành công',
        data: { ...savedReceipt, lines: savedLines },
      };
    });
  }

  async cancelReceipt(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(ErpGoodsReceipt);
      const lineRepo = manager.getRepository(ErpGoodsReceiptLine);
      const txnRepo = manager.getRepository(ErpInventoryTransaction);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const poRepo = manager.getRepository(ErpPurchaseOrder);
      const poLineRepo = manager.getRepository(ErpPurchaseOrderLine);
      const moRepo = manager.getRepository(ErpProductionOrder);

      const receipt = await this.getReceiptOrThrow(receiptRepo, id);
      if (receipt.status === 'CANCELLED') {
        throw new BadRequestException('Phiếu nhập đã bị hủy trước đó');
      }
      if (receipt.status !== 'POSTED') {
        throw new BadRequestException(
          'Chỉ có thể hủy phiếu nhập đã ghi sổ (POSTED)',
        );
      }

      await this.dependencyService.checkDependencies('goods_receipts', id);

      const lines = await lineRepo.find({
        where: { goodsReceiptId: id },
        order: { lineNo: 'ASC' },
      });

      for (const line of lines) {
        const qty = Number(line.qtyReceived || 0);
        if (qty <= 0) continue;

        // Reversal transaction (qty_out)
        const unitCost = Number(line.unitCost || 0);
        await txnRepo.save(
          txnRepo.create({
            transactionType: 'RECEIPT_CANCEL',
            documentType: 'GOODS_RECEIPT',
            documentId: receipt.id,
            itemId: line.itemId ?? null,
            warehouseCode: null,
            qtyIn: '0.000',
            qtyOut: qty.toFixed(3),
            unitCost: unitCost.toFixed(3),
            transactionDate: receipt.receiptDate,
            notes: `Hủy phiếu nhập ${receipt.receiptNo}`,
            createdBy: null,
          } as any),
        );

        // Revert inventory balance
        const balance = await balanceRepo.findOne({
          where: { itemId: line.itemId ?? undefined },
        });
        if (balance) {
          const revertedQty = Math.max(0, Number(balance.qtyOnHand) - qty);
          const revertedValue = Math.max(
            0,
            Number(balance.inventoryValue) - qty * unitCost,
          );
          balance.qtyOnHand = revertedQty.toFixed(3);
          balance.inventoryValue = revertedValue.toFixed(3);
          balance.avgUnitCost =
            revertedQty > 0
              ? (revertedValue / revertedQty).toFixed(3)
              : '0.000';
          await balanceRepo.save(balance);
        }

        // Revert PO line qty_received
        if (line.purchaseOrderLineId) {
          const poLine = await poLineRepo.findOneBy({
            id: line.purchaseOrderLineId,
          });
          if (poLine) {
            poLine.qtyReceived = Math.max(
              0,
              Number(poLine.qtyReceived) - qty,
            ).toFixed(3);
            await poLineRepo.save(poLine);
          }
        }
      }

      // Recalc PO receipt status
      if (receipt.purchaseOrderId) {
        const po = await poRepo.findOneBy({ id: receipt.purchaseOrderId });
        if (po) {
          const refreshedLines = await poLineRepo.find({
            where: { purchaseOrderId: po.id },
          });
          const totalOrdered = refreshedLines.reduce(
            (sum, l) => sum + Number(l.qtyOrdered || 0),
            0,
          );
          const totalReceived = refreshedLines.reduce(
            (sum, l) => sum + Number(l.qtyReceived || 0),
            0,
          );
          if (totalReceived <= 0) {
            po.status = po.status === 'CONFIRMED' ? 'CONFIRMED' : 'DRAFT';
          } else if (totalReceived < totalOrdered) {
            po.status = 'PARTIAL_RECEIVED';
          } else {
            po.status = 'RECEIVED';
          }
          await poRepo.save(po);
        }
      }

      if (receipt.productionOrderId) {
        const mo = await moRepo.findOneBy({ id: receipt.productionOrderId });
        if (mo) {
          const totalCancelled = lines.reduce(
            (sum, l) => sum + Number(l.qtyReceived || 0),
            0,
          );
          mo.qtyProduced = Math.max(
            0,
            Number(mo.qtyProduced || 0) - totalCancelled,
          ).toFixed(3);

          if (Number(mo.qtyProduced) <= 0) {
            mo.status =
              mo.status === 'IN_PROGRESS' || mo.status === 'COMPLETED'
                ? 'CONFIRMED'
                : mo.status;
          } else if (Number(mo.qtyProduced) < Number(mo.qtyToProduce || 0)) {
            mo.status = 'IN_PROGRESS';
          }
          await moRepo.save(mo);
        }
      }

      receipt.status = 'CANCELLED';
      const savedReceipt = await receiptRepo.save(receipt);
      const savedLines = await lineRepo.find({
        where: { goodsReceiptId: id },
        order: { lineNo: 'ASC' },
      });

      // --- Reverse journal entry generation removed (accounting module decoupled) ---
      this.logger.log(
        `Goods receipt ${savedReceipt.receiptNo} cancelled; reverse journal entry generation skipped.`,
      );
      // ------------------------------------------------------------------------------

      return {
        message: 'Hủy phiếu nhập thành công',
        data: { ...savedReceipt, lines: savedLines },
      };
    });
  }

  async remove(id: string) {
    const existing = await this.repository.findOneBy({ id });
    if (!existing || existing.isDeleted) {
      throw new NotFoundException('Không tìm thấy phiếu nhập');
    }
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ được xóa phiếu nhập ở trạng thái nháp',
      );
    }
    existing.isDeleted = true;
    const data = await this.repository.save(existing);
    return {
      message: 'Xóa phiếu nhập thành công',
      data,
    };
  }
}
