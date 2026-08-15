import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, Like, Repository, In } from 'typeorm';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpGoodsReceipt } from './entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from './entities/erp_goods_receipt_line.entity';
import { getGMT7YearMonthString } from '../common/utils/date.util';
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
import * as ExcelJS from 'exceljs';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { format } from 'date-fns';

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
    private readonly companyProfileService: CompanyProfileService,
  ) {}

  /**
   * Tự động tạo serial numbers cho linh kiện có tracking policy = SERIAL.
   * Format: {SKU}-{YYYYMMDD}-{XXXXX}
   * VD: ENG-DC-48V-20260803-00001
   *
   * @param manager    TypeORM EntityManager (trong transaction)
   * @param item       Item cần tạo serial
   * @param qty        Số lượng serial cần tạo
   * @param receiptLineId  ID của dòng nhập kho để link ngược
   * @param receiptDate   Ngày nhập kho (YYYY-MM-DD)
   */
  public async generateComponentSerials(
    manager: any,
    item: ErpInventoryItem,
    qty: number,
    receiptLineId: string,
    receiptDate: string,
  ): Promise<ErpInventoryTrackingSerial[]> {
    const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
    const dateStr = format(new Date(receiptDate), 'yyMMdd'); // VD: '260803'
    const prefix = `SN-${item.sku}${dateStr}`;

    // Tìm serial cuối cùng có cùng prefix hôm nay để tính số thứ tự tiếp theo
    const lastSerial = await serialRepo.findOne({
      where: { serialNo: Like(`${prefix}%`) },
      order: { serialNo: 'DESC' },
    });

    const lastSeq = lastSerial
      ? parseInt(lastSerial.serialNo.slice(-5), 10) // Lấy 5 ký tự cuối
      : 0;

    const newSerials: ErpInventoryTrackingSerial[] = [];
    for (let i = 1; i <= qty; i++) {
      const serialNo = `${prefix}${String(lastSeq + i).padStart(5, '0')}`;
      newSerials.push(
        serialRepo.create({
          itemId: item.id,
          serialNo,
          status: 'IN_STOCK',
          vinId: null,
          customId: null,
          receiptLineId,
          productionOrderId: null,
          salesOrderLineId: null,
          goodsIssueLineId: null,
          lotNo: null,
          notes: null,
          attributes: null,
        } as any),
      );
    }

    const chunkSize = 1000;
    for (let j = 0; j < newSerials.length; j += chunkSize) {
      await serialRepo.insert(newSerials.slice(j, j + chunkSize));
    }
    const created = newSerials;

    this.logger.log(
      `Auto-generated ${qty} serial(s) for item ${item.sku} (${prefix}${String(lastSeq + 1).padStart(5, '0')} → ${String(lastSeq + qty).padStart(5, '0')})`,
    );
    return created;
  }

  private async generateMonthlyReceiptNo(manager: any, receiptDate?: string) {
    const ym = getGMT7YearMonthString(receiptDate);
    const prefix = `NK-${ym}`;
    const latest = await manager
      .getRepository(ErpGoodsReceipt)
      .createQueryBuilder('gr')
      .where('gr.receiptNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('LENGTH(gr.receiptNo)', 'DESC')
      .addOrderBy('gr.receiptNo', 'DESC')
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

  async validateSerials(dto: { itemId?: string; serials: string[] }) {
    const rawSerials = (dto.serials || [])
      .map((s) => s?.trim())
      .filter(Boolean);
    const internalDuplicates: string[] = [];
    const seen = new Set<string>();
    for (const s of rawSerials) {
      if (seen.has(s)) {
        internalDuplicates.push(s);
      } else {
        seen.add(s);
      }
    }

    let dbDuplicates: string[] = [];
    if (seen.size > 0) {
      const serialRepo = this.dataSource.getRepository(
        ErpInventoryTrackingSerial,
      );
      const existing = await serialRepo.find({
        where: {
          serialNo: In(Array.from(seen)),
          status: 'IN_STOCK',
        },
      });
      dbDuplicates = existing.map((e) => e.serialNo);
    }

    return {
      valid: internalDuplicates.length === 0 && dbDuplicates.length === 0,
      internalDuplicates: Array.from(new Set(internalDuplicates)),
      dbDuplicates: Array.from(new Set(dbDuplicates)),
    };
  }

  async generatePreviewSerials(dto: {
    itemId: string;
    qty: number;
    receiptDate?: string;
  }) {
    const itemRepo = this.dataSource.getRepository(ErpInventoryItem);
    const serialRepo = this.dataSource.getRepository(
      ErpInventoryTrackingSerial,
    );
    const item = await itemRepo.findOneBy({ id: dto.itemId });
    if (!item) throw new NotFoundException('Không tìm thấy item');

    const qty = Math.max(1, Math.min(10000, Math.round(dto.qty || 1)));
    const dateStr = format(
      dto.receiptDate ? new Date(dto.receiptDate) : new Date(),
      'yyMMdd',
    );
    const prefix = `SN-${item.sku}${dateStr}`;

    const lastSerial = await serialRepo.findOne({
      where: { serialNo: Like(`${prefix}%`) },
      order: { serialNo: 'DESC' },
    });

    const lastSeq = lastSerial
      ? parseInt(lastSerial.serialNo.slice(-5), 10) || 0
      : 0;

    const serials: string[] = [];
    for (let i = 1; i <= qty; i++) {
      serials.push(`${prefix}${String(lastSeq + i).padStart(5, '0')}`);
    }

    return { serials };
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
          declaredSerials: line.declaredSerials ?? null,
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
      defaultOrder: { receiptDate: 'DESC' },
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
      const { remarks } = dto as any;
      if (remarks !== undefined) {
        await this.repository.update(id, { remarks });
        await this.dataSource
          .getRepository(ErpInventoryTransaction)
          .update(
            { documentType: 'GOODS_RECEIPT', documentId: id },
            { notes: remarks },
          );
      }
      return this.findOne(id);
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
            declaredSerials: line.declaredSerials ?? null,
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

      // Merge declared serials from dto.lines if provided in post request
      if (Array.isArray(dto.lines) && dto.lines.length > 0) {
        for (const dtoLine of dto.lines) {
          const lineId = (dtoLine as any).id;
          const match = lines.find(
            (l) =>
              (lineId && l.id === lineId) ||
              (dtoLine.purchaseOrderLineId &&
                l.purchaseOrderLineId === dtoLine.purchaseOrderLineId) ||
              (dtoLine.itemId && l.itemId === dtoLine.itemId),
          );
          if (match && dtoLine.declaredSerials !== undefined) {
            match.declaredSerials = dtoLine.declaredSerials;
          }
        }
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

      // ── PRE-FETCH tất cả balances và PO lines để tránh N+1 queries ──────────
      const itemIds = [
        ...new Set(lines.map((l) => l.itemId).filter(Boolean)),
      ] as string[];
      const poLineIds = [
        ...new Set(lines.map((l) => l.purchaseOrderLineId).filter(Boolean)),
      ] as string[];

      const [existingBalances, existingPoLines] = await Promise.all([
        itemIds.length > 0
          ? balanceRepo.find({
              where: itemIds.map((id) => ({
                itemId: id,
                warehouseCode: dto.warehouseCode ?? undefined,
              })) as any,
            })
          : Promise.resolve([]),
        poLineIds.length > 0
          ? poLineRepo.findBy({ id: In(poLineIds) as any })
          : Promise.resolve([]),
      ]);

      // Build lookup Maps in memory — O(1) access in the loop
      const balanceMap = new Map<string, ErpInventoryBalance>();
      for (const b of existingBalances) {
        if (b.itemId) balanceMap.set(b.itemId, b);
      }
      const poLineMap = new Map<string, ErpPurchaseOrderLine>();
      for (const p of existingPoLines) {
        poLineMap.set(p.id, p);
      }

      // ── Collect all mutations — compute in memory ─────────────────────────
      const txnsToInsert: any[] = [];
      const balancesToSave: ErpInventoryBalance[] = [];
      const newBalancesToSave: DeepPartial<ErpInventoryBalance>[] = [];
      const poLinesToSave: ErpPurchaseOrderLine[] = [];

      for (const line of lines) {
        const qty = Number(line.qtyReceived || 0);
        if (qty <= 0) {
          throw new BadRequestException(
            `Dòng ${line.lineNo} có số lượng nhận không hợp lệ`,
          );
        }

        const incomingUnitCost = Number(line.unitCost || 0);
        const balance = line.itemId
          ? (balanceMap.get(line.itemId) ?? null)
          : null;
        const currentQty = Number(balance?.qtyOnHand || 0);
        const currentValue = Number(balance?.inventoryValue || 0);
        const receiptValue = qty * incomingUnitCost;
        const nextQty = currentQty + qty;
        const nextValue = currentValue + receiptValue;
        const nextAvgUnitCost = nextQty > 0 ? nextValue / nextQty : 0;

        txnsToInsert.push({
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
        });

        if (!balance) {
          newBalancesToSave.push({
            itemId: line.itemId ?? null,
            warehouseCode: dto.warehouseCode ?? null,
            qtyOnHand: nextQty.toFixed(3),
            avgUnitCost: nextAvgUnitCost.toFixed(3),
            inventoryValue: nextValue.toFixed(3),
          });
        } else {
          balance.qtyOnHand = nextQty.toFixed(3);
          balance.avgUnitCost = nextAvgUnitCost.toFixed(3);
          balance.inventoryValue = nextValue.toFixed(3);
          balancesToSave.push(balance);
          // Update the map in case same item appears in multiple lines
          balanceMap.set(balance.itemId!, balance);
        }

        if (line.purchaseOrderLineId) {
          const poLine = poLineMap.get(line.purchaseOrderLineId) ?? null;
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
          poLine.qtyReceived = (Number(poLine.qtyReceived || 0) + qty).toFixed(
            3,
          );
          poLinesToSave.push(poLine);
          poLineMap.set(poLine.id, poLine); // Keep map in sync for next line with same PO line
        }
      }

      // ── Bulk write: 4 round-trips total instead of 4×N ───────────────────
      await Promise.all([
        txnsToInsert.length > 0
          ? txnRepo.insert(txnsToInsert)
          : Promise.resolve(),
        balancesToSave.length > 0
          ? balanceRepo.save(balancesToSave)
          : Promise.resolve(),
        newBalancesToSave.length > 0
          ? balanceRepo.save(newBalancesToSave)
          : Promise.resolve(),
        poLinesToSave.length > 0
          ? poLineRepo.save(poLinesToSave)
          : Promise.resolve(),
      ]);

      // ── Update PO header status ───────────────────────────────────────────
      if (receipt.purchaseOrderId) {
        const po = await poRepo.findOneBy({ id: receipt.purchaseOrderId });
        if (po) {
          const refreshedLines = [...poLineMap.values()];
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

      // ── Process Tracking Serials for lines with SERIAL / VEHICLE / CUSTOM policy ──
      const itemRepo = manager?.getRepository
        ? manager.getRepository(ErpInventoryItem)
        : null;
      const trackingSerialRepo = manager?.getRepository
        ? manager.getRepository(ErpInventoryTrackingSerial)
        : null;
      const itemsWithPolicy =
        itemIds.length > 0 && itemRepo?.find
          ? await itemRepo.find({
              where: { id: In(itemIds) },
              relations: ['trackingPolicy'],
            })
          : [];
      const itemPolicyMap = new Map(itemsWithPolicy.map((i) => [i.id, i]));

      const serialsToInsert: DeepPartial<ErpInventoryTrackingSerial>[] = [];

      for (const line of lines) {
        const item = line.itemId ? itemPolicyMap.get(line.itemId) : null;
        const trackingCode = item?.trackingPolicy?.code;
        const qty = Math.round(Number(line.qtyReceived || 0));

        if (
          trackingCode === 'SERIAL' ||
          trackingCode === 'VEHICLE' ||
          trackingCode === 'CUSTOM'
        ) {
          const declared = line.declaredSerials || [];
          if (declared.length < qty) {
            throw new BadRequestException(
              `Dòng ${line.lineNo} (${item?.sku || 'Item'}): Chưa khai báo đủ số lượng Serial/Tracking (cần ${qty}, đã khai báo ${declared.length}).`,
            );
          }

          // Check internal duplicates in line
          const rawSerialNos = declared
            .map((d) => d.serialNo?.trim())
            .filter(Boolean);
          const uniqueSerialNos = new Set(rawSerialNos);
          if (uniqueSerialNos.size !== rawSerialNos.length) {
            throw new BadRequestException(
              `Dòng ${line.lineNo} (${item?.sku}): Có mã Serial/Tracking bị trùng lặp trong danh sách khai báo.`,
            );
          }

          // Check duplicates against DB (IN_STOCK)
          if (rawSerialNos.length > 0 && trackingSerialRepo?.find) {
            const existingSerials = await trackingSerialRepo.find({
              where: {
                serialNo: In(rawSerialNos),
                status: 'IN_STOCK',
              },
            });
            if (existingSerials.length > 0) {
              const dupes = existingSerials.map((s) => s.serialNo).join(', ');
              throw new BadRequestException(
                `Dòng ${line.lineNo} (${item?.sku}): Các mã Serial sau đã tồn tại trong kho (IN_STOCK): ${dupes}`,
              );
            }
          }

          for (const d of declared.slice(0, qty)) {
            serialsToInsert.push({
              itemId: line.itemId ?? null,
              serialNo: d.serialNo.trim(),
              status: 'IN_STOCK',
              vinId: null,
              customId: null,
              receiptLineId: line.id,
              lotNo: d.lotNo || null,
              notes: d.notes || null,
              attributes: d.attributes || null,
            });
          }
          line.serialsGenerated = true;
        } else {
          line.serialsGenerated = true;
        }
      }

      if (serialsToInsert.length > 0 && trackingSerialRepo?.insert) {
        const chunkSize = 1000;
        for (let j = 0; j < serialsToInsert.length; j += chunkSize) {
          await trackingSerialRepo.insert(
            serialsToInsert.slice(j, j + chunkSize),
          );
        }
      }
      if (lineRepo?.save) {
        await lineRepo.save(lines);
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
      const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);

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

      const receiptLineIds = lines.map((line) => line.id);
      const receiptSerials =
        receiptLineIds.length > 0
          ? await serialRepo.find({
              where: { receiptLineId: In(receiptLineIds) },
            })
          : [];

      const inUseSerials = receiptSerials.filter(
        (serial) =>
          serial.status !== 'IN_STOCK' ||
          !!serial.salesOrderLineId ||
          !!serial.goodsIssueLineId ||
          !!serial.vinId ||
          !!serial.productionOrderId,
      );

      if (inUseSerials.length > 0) {
        throw new BadRequestException(
          'Không thể hủy phiếu nhập vì có serial đã được sử dụng ở nghiệp vụ khác',
        );
      }

      // ── PRE-FETCH tất cả balances và PO lines ────────────────────────────
      const cancelItemIds = [
        ...new Set(lines.map((l) => l.itemId).filter(Boolean)),
      ] as string[];
      const cancelPoLineIds = [
        ...new Set(lines.map((l) => l.purchaseOrderLineId).filter(Boolean)),
      ] as string[];

      const [cancelBalances, cancelPoLines] = await Promise.all([
        cancelItemIds.length > 0
          ? balanceRepo.findBy({ itemId: In(cancelItemIds) as any })
          : Promise.resolve([]),
        cancelPoLineIds.length > 0
          ? poLineRepo.findBy({ id: In(cancelPoLineIds) as any })
          : Promise.resolve([]),
      ]);

      const cancelBalanceMap = new Map<string, ErpInventoryBalance>();
      for (const b of cancelBalances) {
        if (b.itemId) cancelBalanceMap.set(b.itemId, b);
      }
      const cancelPoLineMap = new Map<string, ErpPurchaseOrderLine>();
      for (const p of cancelPoLines) {
        cancelPoLineMap.set(p.id, p);
      }

      // ── Compute reversals in memory ───────────────────────────────────────
      const cancelTxns: any[] = [];
      const cancelBalancesToSave: ErpInventoryBalance[] = [];
      const cancelPoLinesToSave: ErpPurchaseOrderLine[] = [];

      for (const line of lines) {
        const qty = Number(line.qtyReceived || 0);
        if (qty <= 0) continue;

        const unitCost = Number(line.unitCost || 0);
        cancelTxns.push({
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
        });

        if (line.itemId) {
          const balance = cancelBalanceMap.get(line.itemId);
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
            cancelBalancesToSave.push(balance);
            cancelBalanceMap.set(line.itemId, balance);
          }
        }

        if (line.purchaseOrderLineId) {
          const poLine = cancelPoLineMap.get(line.purchaseOrderLineId);
          if (poLine) {
            poLine.qtyReceived = Math.max(
              0,
              Number(poLine.qtyReceived) - qty,
            ).toFixed(3);
            cancelPoLinesToSave.push(poLine);
            cancelPoLineMap.set(poLine.id, poLine);
          }
        }
      }

      // ── Bulk write ────────────────────────────────────────────────────────
      await Promise.all([
        cancelTxns.length > 0 ? txnRepo.insert(cancelTxns) : Promise.resolve(),
        cancelBalancesToSave.length > 0
          ? balanceRepo.save(cancelBalancesToSave)
          : Promise.resolve(),
        cancelPoLinesToSave.length > 0
          ? poLineRepo.save(cancelPoLinesToSave)
          : Promise.resolve(),
        receiptSerials.length > 0
          ? serialRepo.delete({
              id: In(receiptSerials.map((serial) => serial.id)),
            })
          : Promise.resolve(),
      ]);

      // Recalc PO receipt status
      if (receipt.purchaseOrderId) {
        const po = await poRepo.findOneBy({ id: receipt.purchaseOrderId });
        if (po) {
          const refreshedLines = [...cancelPoLineMap.values()];
          const totalOrdered = refreshedLines.reduce(
            (sum, l) => sum + Number(l.qtyOrdered || 0),
            0,
          );
          const totalReceived = refreshedLines.reduce(
            (sum, l) => sum + Number(l.qtyReceived || 0),
            0,
          );
          if (totalReceived <= 0) {
            po.status = po.status === 'CONFIRMED' ? 'CONFIRMED' : 'APPROVED';
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

  async exportXlsx(id: string): Promise<Buffer> {
    const receiptRes = await this.findOne(id);
    if (!receiptRes || !receiptRes.data) {
      throw new NotFoundException('Không tìm thấy phiếu nhập');
    }
    const receipt = receiptRes.data;

    const companyProfile = await this.companyProfileService.getProfile();
    const itemIds = receipt.lines?.map((l) => l.itemId).filter(Boolean) || [];
    const items = itemIds.length
      ? await this.dataSource
          .getRepository(ErpInventoryItem)
          .findBy({ id: In(itemIds) })
      : [];
    const itemsDict = Object.fromEntries(items.map((i) => [i.id, i]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Phiếu Nhập Kho', {
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        margins: {
          left: 0.4,
          right: 0.4,
          top: 0.4,
          bottom: 0.4,
          header: 0.3,
          footer: 0.3,
        },
      },
      views: [{ showGridLines: false }],
    });

    const defaultFont = { name: 'Times New Roman', size: 12 };

    // Header setup
    sheet.getColumn('A').width = 5;
    sheet.getColumn('B').width = 30;
    sheet.getColumn('C').width = 18;
    sheet.getColumn('D').width = 10;
    sheet.getColumn('E').width = 12;
    sheet.getColumn('F').width = 12;
    sheet.getColumn('G').width = 15;
    sheet.getColumn('H').width = 18;

    // Row 1: Company + Form
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = (
      companyProfile?.company_name || 'Đơn vị: ............................'
    ).toUpperCase();
    sheet.getCell('A1').font = { ...defaultFont, bold: true };
    sheet.getCell('A1').alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
    };

    sheet.mergeCells('F1:H1');
    sheet.getCell('F1').value = 'Mẫu số 01 - VT';
    sheet.getCell('F1').font = { ...defaultFont, bold: true };
    sheet.getCell('F1').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };
    sheet.getRow(1).height = 25;

    // Row 2: Address + Form sub
    sheet.mergeCells('A2:E2');
    sheet.getCell('A2').value =
      companyProfile?.address || 'Địa chỉ: ............................';
    sheet.getCell('A2').font = defaultFont;
    sheet.getCell('A2').alignment = {
      vertical: 'top',
      horizontal: 'left',
      wrapText: true,
    };

    sheet.mergeCells('F2:H2');
    sheet.getCell('F2').value =
      '(Kèm theo Thông tư số 99/2025/TT-BTC ngày 27 tháng 10 năm 2025 của Bộ trưởng Bộ Tài chính)';
    sheet.getCell('F2').font = { ...defaultFont, italic: true, size: 10 };
    sheet.getCell('F2').alignment = {
      vertical: 'top',
      horizontal: 'center',
      wrapText: true,
    };
    sheet.getRow(2).height = 35;

    // Row 3: Title
    sheet.mergeCells('A4:H4');
    sheet.getCell('A4').value = 'PHIẾU NHẬP KHO';
    sheet.getCell('A4').font = { ...defaultFont, bold: true, size: 16 };
    sheet.getCell('A4').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    // Row 4: Date
    const receiptDate = receipt.receiptDate
      ? new Date(receipt.receiptDate)
      : new Date();
    sheet.mergeCells('A5:H5');
    sheet.getCell('A5').value =
      `Ngày ${format(receiptDate, 'dd')} tháng ${format(receiptDate, 'MM')} năm ${format(receiptDate, 'yyyy')}`;
    sheet.getCell('A5').font = { ...defaultFont, italic: true };
    sheet.getCell('A5').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    // Row 5: Info
    sheet.mergeCells('A6:H6');
    sheet.getCell('A6').value =
      `Số: ${receipt.receiptNo}        Nợ: ............        Có: ............`;
    sheet.getCell('A6').font = { ...defaultFont, bold: true };
    sheet.getCell('A6').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    sheet.addRow([]);

    const infoRow1 = sheet.addRow([
      `- Họ và tên người giao: ${receipt.supplierName || '..................................................................'}`,
    ]);
    sheet.mergeCells(`A${infoRow1.number}:H${infoRow1.number}`);
    infoRow1.getCell('A').alignment = { wrapText: true, vertical: 'middle' };

    const infoRow2 = sheet.addRow([
      `- Theo .............................. số: .............. ngày ...... tháng ...... năm ......... của ....................................`,
    ]);
    sheet.mergeCells(`A${infoRow2.number}:H${infoRow2.number}`);
    infoRow2.getCell('A').alignment = { wrapText: true, vertical: 'middle' };

    const infoRow3 = sheet.addRow([
      `- Nhập tại kho: ...................................................... địa điểm ............................................................`,
    ]);
    sheet.mergeCells(`A${infoRow3.number}:H${infoRow3.number}`);
    infoRow3.getCell('A').alignment = { wrapText: true, vertical: 'middle' };

    const infoRow4 = sheet.addRow([
      `- Ghi chú: ${receipt.remarks || '..................................................................'}`,
    ]);
    sheet.mergeCells(`A${infoRow4.number}:H${infoRow4.number}`);
    infoRow4.getCell('A').alignment = { wrapText: true, vertical: 'middle' };

    sheet.addRow([]);

    // Table Headers
    const headerRow1 = sheet.addRow([
      'STT',
      'Tên, nhãn hiệu, quy cách...',
      'Mã số',
      'Đơn vị tính',
      'Số lượng',
      '',
      'Đơn giá',
      'Thành tiền',
    ]);
    const headerRow2 = sheet.addRow([
      '',
      '',
      '',
      '',
      'Theo chứng từ',
      'Thực nhập',
      '',
      '',
    ]);
    const headerRow3 = sheet.addRow(['A', 'B', 'C', 'D', '1', '2', '3', '4']);

    sheet.mergeCells(`A${headerRow1.number}:A${headerRow2.number}`);
    sheet.mergeCells(`B${headerRow1.number}:B${headerRow2.number}`);
    sheet.mergeCells(`C${headerRow1.number}:C${headerRow2.number}`);
    sheet.mergeCells(`D${headerRow1.number}:D${headerRow2.number}`);
    sheet.mergeCells(`E${headerRow1.number}:F${headerRow1.number}`);
    sheet.mergeCells(`G${headerRow1.number}:G${headerRow2.number}`);
    sheet.mergeCells(`H${headerRow1.number}:H${headerRow2.number}`);

    [headerRow1, headerRow2, headerRow3].forEach((row) => {
      row.eachCell((cell) => {
        cell.font = { ...defaultFont, bold: row !== headerRow3 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    let totalQty = 0;
    let totalAmount = 0;

    (receipt.lines || []).forEach((line, index) => {
      const item = itemsDict[line.itemId || ''];
      const qty = Number(line.qtyReceived) || 0;
      const cost = Number(line.unitCost) || 0;
      const amount = qty * cost;
      totalQty += qty;
      totalAmount += amount;

      const row = sheet.addRow([
        index + 1,
        item?.itemName || '',
        item?.sku || line.itemId || '',
        '',
        '',
        qty,
        cost,
        amount,
      ]);
      row.eachCell((cell, colNum) => {
        cell.font = defaultFont;
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        if (colNum === 1 || colNum === 3 || colNum === 4 || colNum === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNum >= 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0.00';
        } else {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'left',
            wrapText: true,
          };
        }
      });
    });

    const summaryRow = sheet.addRow([
      'Cộng',
      '',
      '',
      '',
      'x',
      totalQty,
      'x',
      totalAmount,
    ]);
    sheet.mergeCells(`A${summaryRow.number}:D${summaryRow.number}`);
    summaryRow.eachCell((cell, colNum) => {
      cell.font = { ...defaultFont, bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      if (colNum === 1 || colNum === 5 || colNum === 7) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNum === 6 || colNum === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '#,##0.00';
      }
    });

    sheet.addRow([]);
    sheet.addRow([
      '- Tổng số tiền (viết bằng chữ):',
      '........................................................................................................................',
    ]);
    sheet.mergeCells(`B${sheet.lastRow!.number}:H${sheet.lastRow!.number}`);
    sheet.addRow([
      '- Số chứng từ gốc kèm theo:',
      '........................................................................................................................',
    ]);
    sheet.mergeCells(`B${sheet.lastRow!.number}:H${sheet.lastRow!.number}`);

    sheet.addRow([]);
    const dateRow = sheet.addRow([
      '',
      '',
      '',
      '',
      '',
      '',
      `Ngày ${format(receiptDate, 'dd')} tháng ${format(receiptDate, 'MM')} năm ${format(receiptDate, 'yyyy')}`,
    ]);
    sheet.mergeCells(`G${dateRow.number}:H${dateRow.number}`);
    dateRow.getCell('G').font = { ...defaultFont, italic: true };
    dateRow.getCell('G').alignment = {
      vertical: 'middle',
      horizontal: 'center',
    };

    const signRow1 = sheet.addRow([
      'Người lập phiếu',
      '',
      'Thủ kho',
      '',
      'Kế toán trưởng',
      '',
      'Giám đốc',
      '',
    ]);
    sheet.mergeCells(`A${signRow1.number}:B${signRow1.number}`);
    sheet.mergeCells(`C${signRow1.number}:D${signRow1.number}`);
    sheet.mergeCells(`E${signRow1.number}:F${signRow1.number}`);
    sheet.mergeCells(`G${signRow1.number}:H${signRow1.number}`);
    signRow1.eachCell((cell) => {
      cell.font = { ...defaultFont, bold: true };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
    });

    const signRow2 = sheet.addRow([
      '(Ký, họ tên)',
      '',
      '(Ký, họ tên)',
      '',
      '(Hoặc bộ phận có nhu cầu nhập)',
      '',
      '(Ký, họ tên)',
      '',
    ]);
    sheet.mergeCells(`A${signRow2.number}:B${signRow2.number}`);
    sheet.mergeCells(`C${signRow2.number}:D${signRow2.number}`);
    sheet.mergeCells(`E${signRow2.number}:F${signRow2.number}`);
    sheet.mergeCells(`G${signRow2.number}:H${signRow2.number}`);
    signRow2.eachCell((cell) => {
      cell.font = { ...defaultFont, italic: true, size: 10 };
      cell.alignment = {
        vertical: 'top',
        horizontal: 'center',
        wrapText: true,
      };
    });
    sheet.getRow(signRow2.number).height = 30;

    const signRow3 = sheet.addRow(['', '', '', '', '(Ký, họ tên)', '', '', '']);
    sheet.mergeCells(`A${signRow3.number}:B${signRow3.number}`);
    sheet.mergeCells(`C${signRow3.number}:D${signRow3.number}`);
    sheet.mergeCells(`E${signRow3.number}:F${signRow3.number}`);
    sheet.mergeCells(`G${signRow3.number}:H${signRow3.number}`);
    signRow3.eachCell((cell) => {
      cell.font = { ...defaultFont, italic: true, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
