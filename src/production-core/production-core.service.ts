import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  ILike,
  In,
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { ErpBom } from '../bom-core/entities/erp_bom.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { resolveSortOrder } from '../common/utils/sort.util';
import { ErpBomLine } from '../bom-core/entities/erp_bom_line.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ExecuteProductionDto } from './dto/execute-production.dto';
import { ErpProductionOrder } from './entities/erp_production_order.entity';
import { getGMT7YearMonthString } from '../common/utils/date.util';
import { ErpProductionOrderMaterial } from './entities/erp_production_order_material.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpGoodsIssue } from '../goods-issues-core/entities/erp_goods_issue.entity';
import { ErpGoodsIssueLine } from '../goods-issues-core/entities/erp_goods_issue_line.entity';
import { ErpGoodsReceipt } from '../goods-receipts-core/entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from '../goods-receipts-core/entities/erp_goods_receipt_line.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpVehicle } from '../erp-mfg-core/entities/erp_vehicle.entity';
import { StartProductionDto } from './dto/start-production.dto';
import { CompleteProductionDto } from './dto/complete-production.dto';

import { ListProductionDto } from './dto/list-production.dto';

@Injectable()
export class ProductionCoreService {
  private formatInventoryItemLabel(
    item?: Partial<ErpInventoryItem> | null,
    fallbackId?: string | null,
  ) {
    const sku = item?.sku?.trim();
    const itemName = item?.itemName?.trim();
    if (sku && itemName) return `${sku} — ${itemName}`;
    if (sku) return sku;
    if (itemName) return itemName;
    return fallbackId ?? 'N/A';
  }

  async generateProductionReferenceNo() {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthlyCount = await this.productionOrderRepository.count({
      where: {
        isDeleted: false,
        createdAt: Between(start, end),
      } as any,
    });

    return `MO-${yearMonth}${String(monthlyCount + 1).padStart(4, '0')}`;
  }

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpBom)
    private readonly bomRepository: Repository<ErpBom>,
    @InjectRepository(ErpBomLine)
    private readonly bomLineRepository: Repository<ErpBomLine>,
    @InjectRepository(ErpInventoryBalance)
    private readonly balanceRepository: Repository<ErpInventoryBalance>,
    @InjectRepository(ErpInventoryTransaction)
    private readonly transactionRepository: Repository<ErpInventoryTransaction>,
    @InjectRepository(ErpProductionOrder)
    private readonly productionOrderRepository: Repository<ErpProductionOrder>,
    @InjectRepository(ErpProductionOrderMaterial)
    private readonly productionMaterialRepository: Repository<ErpProductionOrderMaterial>,
    @InjectRepository(ErpGoodsIssue)
    private readonly goodsIssueRepository: Repository<ErpGoodsIssue>,
    @InjectRepository(ErpGoodsIssueLine)
    private readonly goodsIssueLineRepository: Repository<ErpGoodsIssueLine>,
    @InjectRepository(ErpGoodsReceipt)
    private readonly goodsReceiptRepository: Repository<ErpGoodsReceipt>,
    @InjectRepository(ErpGoodsReceiptLine)
    private readonly goodsReceiptLineRepository: Repository<ErpGoodsReceiptLine>,
  ) {}

  async findOrders(query: ListProductionDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const order = resolveSortOrder(query.sort, {
      allowedFields: [
        'createdAt',
        'referenceNo',
        'status',
        'plannedStartDate',
        'plannedEndDate',
        'finishedGoodItemName',
        'qtyProduced',
      ],
      columnMap: {
        created_at: 'createdAt',
        reference_no: 'referenceNo',
        planned_start_date: 'plannedStartDate',
        planned_end_date: 'plannedEndDate',
        finished_good_item_name: 'finishedGoodItemName',
        qty_produced: 'qtyProduced',
      },
      defaultOrder: { createdAt: 'DESC' },
    });

    const qb = this.productionOrderRepository
      .createQueryBuilder('po')
      .leftJoin(ErpInventoryItem, 'item', 'item.id = po.finishedGoodItemId')
      .where('po.isDeleted = :isDeleted', { isDeleted: false });

    if (query.search) {
      qb.andWhere('po.referenceNo ILIKE :search', {
        search: `%${query.search}%`,
      });
    }
    if (query.status) {
      qb.andWhere('po.status = :status', { status: query.status });
    }
    if (query.finishedGoodItemId) {
      qb.andWhere('po.finishedGoodItemId = :fgId', {
        fgId: query.finishedGoodItemId,
      });
    }
    if (query.dateFrom && query.dateTo) {
      qb.andWhere('po.plannedStartDate BETWEEN :from AND :to', {
        from: query.dateFrom,
        to: query.dateTo,
      });
    } else if (query.dateFrom) {
      qb.andWhere('po.plannedStartDate >= :from', { from: query.dateFrom });
    } else if (query.dateTo) {
      qb.andWhere('po.plannedStartDate <= :to', { to: query.dateTo });
    }

    for (const [key, dir] of Object.entries(order)) {
      if (key === 'finishedGoodItemName') {
        qb.addOrderBy('item.itemName', dir);
      } else {
        qb.addOrderBy(`po.${key}`, dir);
      }
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    const finishedGoodIds = Array.from(
      new Set(items.map((item) => item.finishedGoodItemId).filter(Boolean)),
    ) as string[];
    const itemRepo = this.dataSource.getRepository(ErpInventoryItem);
    const inventoryItems = finishedGoodIds.length
      ? await itemRepo.find({ where: { id: In(finishedGoodIds) } })
      : [];
    const itemNameMap = new Map(
      inventoryItems.map((item) => [item.id, item.itemName]),
    );

    return {
      items: items.map((item) => ({
        ...item,
        finishedGoodItemName:
          itemNameMap.get(item.finishedGoodItemId ?? '') ?? null,
        qtyProduced: item.qtyProduced,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async explodePreview(bomId: string, qtyToProduce: number) {
    const bomRepo = this.dataSource.getRepository(ErpBom);
    const bomLineRepo = this.dataSource.getRepository(ErpBomLine);
    const itemRepo = this.dataSource.getRepository(ErpInventoryItem);

    const bom = await bomRepo.findOne({ where: { id: bomId } });
    if (!bom) {
      throw new NotFoundException('Không tìm thấy BOM');
    }

    const exploded = new Map<string, { itemId: string; qtyRequired: number }>();
    const explosionTree: any[] = [];
    await this.explodeBom(
      bom.id,
      qtyToProduce,
      bomRepo,
      bomLineRepo,
      exploded,
      explosionTree,
      bom.finishedGoodItemId,
    );

    const finalMaterials = Array.from(exploded.values());

    const collectTreeItemIds = (nodes: any[], set: Set<string>) => {
      for (const node of nodes) {
        set.add(node.itemId);
        if (node.children) collectTreeItemIds(node.children, set);
      }
    };
    const allItemIds = new Set<string>(finalMaterials.map((m) => m.itemId));
    collectTreeItemIds(explosionTree, allItemIds);

    const inventoryItems = allItemIds.size
      ? await itemRepo.find({ where: { id: In(Array.from(allItemIds)) } })
      : [];
    const inventoryItemMap = new Map(
      inventoryItems.map((item) => [item.id, item]),
    );

    const populateTreeItems = (nodes: any[]) => {
      for (const node of nodes) {
        const item = inventoryItemMap.get(node.itemId);
        if (item) {
          node.itemName = item.itemName;
          node.itemCode = item.sku;
          node.uom = item.uom;
        }
        if (node.children) populateTreeItems(node.children);
      }
    };
    populateTreeItems(explosionTree);

    const materialsWithDetails = finalMaterials.map((m) => {
      const item = inventoryItemMap.get(m.itemId);
      return {
        ...m,
        itemName: item?.itemName,
        itemCode: item?.sku,
        uom: item?.uom,
      };
    });

    return {
      flatMaterials: materialsWithDetails,
      explosionTree,
    };
  }

  async execute(dto: ExecuteProductionDto) {
    return this.dataSource.transaction(async (manager) => {
      const bomRepo = manager.getRepository(ErpBom);
      const bomLineRepo = manager.getRepository(ErpBomLine);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const productionRepo = manager.getRepository(ErpProductionOrder);
      const materialRepo = manager.getRepository(ErpProductionOrderMaterial);
      const itemRepo = manager.getRepository(ErpInventoryItem);

      const rootBom = dto.bomId
        ? await bomRepo.findOne({
            where: {
              id: dto.bomId,
              finishedGoodItemId: dto.finishedGoodItemId,
            },
          })
        : await bomRepo.findOne({
            where: {
              finishedGoodItemId: dto.finishedGoodItemId,
              status: 'ACTIVE',
            },
            order: { createdAt: 'DESC' },
          });
      if (!rootBom) {
        throw new BadRequestException(
          dto.bomId
            ? 'Không tìm thấy BOM theo id đã chọn cho thành phẩm này'
            : 'Không tìm thấy BOM ACTIVE cho thành phẩm cần sản xuất',
        );
      }

      const qtyToProduce = Number(dto.qtyToProduce || 0);
      if (qtyToProduce <= 0) {
        throw new BadRequestException('Số lượng sản xuất phải lớn hơn 0');
      }

      const exploded = new Map<
        string,
        { itemId: string; qtyRequired: number }
      >();
      const visited = new Set<string>();
      const explosionTree: any[] = [];
      await this.explodeBom(
        rootBom.id,
        qtyToProduce,
        bomRepo,
        bomLineRepo,
        exploded,
        explosionTree,
        rootBom.finishedGoodItemId,
      );
      // Apply materialOverrides: remap any originalItemId -> alternativeItemId
      const overrideMap = new Map<
        string,
        { alternativeItemId: string; notes?: string }
      >();
      if (dto.materialOverrides?.length) {
        for (const ov of dto.materialOverrides) {
          const key = ov.path || ov.originalItemId;
          if (key && ov.alternativeItemId) {
            overrideMap.set(key, {
              alternativeItemId: ov.alternativeItemId,
              notes: ov.notes,
            });
          }
        }
      }

      // Replace itemId with alternativeItemId where override exists, merging qty
      const effectiveMaterials = new Map<
        string,
        {
          itemId: string;
          qtyRequired: number;
          originalItemId?: string;
          alternativeNotes?: string;
        }
      >();

      const traverseTreeAndApplyOverrides = (nodes: any[]) => {
        for (const node of nodes) {
          if (node.isLeaf) {
            const override =
              overrideMap.get(node.path) || overrideMap.get(node.itemId);
            const effectiveItemId = override
              ? override.alternativeItemId
              : node.itemId;
            const existing = effectiveMaterials.get(effectiveItemId);
            effectiveMaterials.set(effectiveItemId, {
              itemId: effectiveItemId,
              qtyRequired: (existing?.qtyRequired ?? 0) + node.qtyRequired,
              originalItemId: override ? node.itemId : undefined,
              alternativeNotes: override?.notes,
            });
          }
          if (node.children) {
            traverseTreeAndApplyOverrides(node.children);
          }
        }
      };
      traverseTreeAndApplyOverrides(explosionTree);

      const finalMaterials = Array.from(effectiveMaterials.values());
      if (finalMaterials.length === 0) {
        throw new BadRequestException(
          'BOM không có định mức nguyên vật liệu khả dụng để xuất',
        );
      }

      const materialItemIds = Array.from(
        new Set(
          finalMaterials.map((material) => material.itemId).filter(Boolean),
        ),
      ) as string[];
      const collectTreeItemIds = (nodes: any[], set: Set<string>) => {
        for (const node of nodes) {
          set.add(node.itemId);
          if (node.children) collectTreeItemIds(node.children, set);
        }
      };
      const allItemIds = new Set<string>(materialItemIds);
      collectTreeItemIds(explosionTree, allItemIds);

      const inventoryItems = allItemIds.size
        ? await itemRepo.find({
            where: { id: In(Array.from(allItemIds)) },
            relations: ['itemType'],
          })
        : [];
      const inventoryItemMap = new Map(
        inventoryItems.map((item) => [item.id, item]),
      );

      const populateTreeItems = (nodes: any[]) => {
        for (const node of nodes) {
          const item = inventoryItemMap.get(node.itemId);
          if (item) {
            node.itemName = item.itemName;
            node.itemCode = item.sku;
            node.uom = item.uom;
          }
          if (node.children) populateTreeItems(node.children);
        }
      };
      populateTreeItems(explosionTree);

      const finishedGoodItem = await itemRepo.findOne({
        where: { id: dto.finishedGoodItemId },
      });

      const balances = await balanceRepo.find({
        where: {
          itemId: In(materialItemIds),
          ...(dto.warehouseCode ? { warehouseCode: dto.warehouseCode } : {}),
        },
      });
      const balanceMap = new Map(balances.map((b) => [b.itemId, b]));

      const targetStatus = dto.status === 'DRAFT' ? 'DRAFT' : 'CONFIRMED';

      // For CONFIRMED orders, validate inventory balances exist and have sufficient qty.
      // For DRAFT, we allow creation even if NVL has no balance yet (planning mode).
      if (targetStatus === 'CONFIRMED') {
        for (const material of finalMaterials) {
          const item = inventoryItemMap.get(material.itemId);
          if (item?.itemType?.code === 'SERVICE') {
            continue; // Bypass inventory check for non-physical service items
          }
          const existingBalance = balanceMap.get(material.itemId);
          if (!existingBalance) {
            const materialLabel = this.formatInventoryItemLabel(
              item,
              material.itemId,
            );
            throw new BadRequestException(
              `Không tìm thấy tồn kho cho NVL ${materialLabel}. Vui lòng nhập kho trước hoặc lưu ở trạng thái DRAFT.`,
            );
          }
        }
      }
      const referenceNo =
        dto.referenceNo?.trim() || (await this.generateProductionReferenceNo());
      const productionPayload: DeepPartial<ErpProductionOrder> = {
        referenceNo,
        finishedGoodItemId: dto.finishedGoodItemId,
        qtyToProduce: qtyToProduce.toFixed(3),
        warehouseCode: dto.warehouseCode ?? null,
        status: targetStatus,
        outputMetadata: {
          ...(dto.outputMetadata ?? {}),
          materialOverrides: dto.materialOverrides ?? [],
          explosionTree,
          bomId: rootBom.id,
        } as any,
        plannedStartDate: dto.plannedStartDate ?? null,
        plannedEndDate: dto.plannedEndDate ?? null,
        createdBy: dto.createdBy ?? null,
      };
      const productionOrder = await productionRepo.save(productionPayload);

      const savedMaterials: any[] = [];
      const materialsToSave: DeepPartial<ErpProductionOrderMaterial>[] = [];
      const balancesToSave: ErpInventoryBalance[] = [];

      for (const material of finalMaterials) {
        const balance = balanceMap.get(material.itemId);
        const currentQty = Number(balance?.qtyOnHand || 0);
        const currentReserved = Number(balance?.qtyReserved || 0);
        const avgUnitCost = Number(balance?.avgUnitCost || 0);
        const availableQty = currentQty - currentReserved;

        const materialItem = inventoryItemMap.get(material.itemId);
        const isService = materialItem?.itemType?.code === 'SERVICE';

        if (
          targetStatus === 'CONFIRMED' &&
          !isService &&
          availableQty < material.qtyRequired
        ) {
          const materialLabel = this.formatInventoryItemLabel(
            materialItem,
            material.itemId,
          );
          throw new BadRequestException(
            `Tồn khả dụng không đủ cho NVL ${materialLabel}. Cần ${material.qtyRequired.toFixed(3)}, có ${availableQty.toFixed(3)}`,
          );
        }

        const amount = material.qtyRequired * avgUnitCost;
        const materialPayload: DeepPartial<ErpProductionOrderMaterial> = {
          productionOrderId: productionOrder.id,
          itemId: material.itemId,
          qtyRequired: material.qtyRequired.toFixed(3),
          unitCost: avgUnitCost.toFixed(3),
          amount: amount.toFixed(3),
        };
        materialsToSave.push(materialPayload);

        savedMaterials.push({
          ...materialPayload,
          itemName: materialItem?.itemName ?? null,
          uom: materialItem?.uom ?? null,
          originalItemId: material.originalItemId ?? null,
          alternativeNotes: material.alternativeNotes ?? null,
        });

        if (targetStatus === 'CONFIRMED' && !isService) {
          balance!.qtyReserved = (
            currentReserved + material.qtyRequired
          ).toFixed(3);
          balancesToSave.push(balance!);
        }
      }

      const savedMaterialEntities = await materialRepo.save(materialsToSave);
      for (let i = 0; i < savedMaterialEntities.length; i++) {
        savedMaterials[i].id = savedMaterialEntities[i].id;
      }
      await balanceRepo.save(balancesToSave);

      return {
        message: 'Tạo lệnh sản xuất thành công',
        data: {
          ...productionOrder,
          finishedGoodItemName: finishedGoodItem?.itemName ?? null,
          materials: savedMaterials,
        },
      };
    });
  }

  async findOne(id: string) {
    const data = await this.productionOrderRepository.findOne({
      where: { id, isDeleted: false },
    });
    if (!data) throw new NotFoundException('Không tìm thấy lệnh sản xuất');

    const materials = await this.productionMaterialRepository.find({
      where: { productionOrderId: id },
      order: { createdAt: 'ASC' },
    });

    let finishedGoodItemName: string | null = null;
    let finishedGoodItemCode: string | null = null;
    let finishedGoodItemTrackingPolicy: string | null = null;
    if (data.finishedGoodItemId) {
      const item = await this.dataSource.query(
        `SELECT 
           i.sku, 
           i.item_name, 
           p.code as tracking_policy 
         FROM public.erp_inventory_items i
         LEFT JOIN public.erp_tracking_policies p ON i.tracking_policy_id = p.id
         WHERE i.id = $1::uuid`,
        [data.finishedGoodItemId],
      );
      if (item.length > 0) {
        finishedGoodItemCode = item[0].sku;
        finishedGoodItemName = item[0].item_name;
        finishedGoodItemTrackingPolicy = item[0].tracking_policy ?? null;
      }
    }

    // Load produced identifiers (vehicles / serials) linked to this production order
    const producedVehicles = await this.dataSource.query(
      `SELECT id, vin_no AS "vinNo", engine_no AS "engineNo", notes, created_at AS "createdAt"
       FROM public.erp_vehicles
       WHERE production_order_id = $1::uuid
       ORDER BY created_at ASC`,
      [id],
    );
    const producedSerials = await this.dataSource.query(
      `SELECT id, serial_no AS "serialNo", lot_no AS "lotNo", notes, created_at AS "createdAt"
       FROM public.erp_inventory_tracking_serials
       WHERE production_order_id = $1::uuid
       ORDER BY created_at ASC`,
      [id],
    );

    if (materials.length > 0) {
      const savedOverrides = Array.isArray(
        data.outputMetadata?.materialOverrides,
      )
        ? data.outputMetadata?.materialOverrides
        : [];
      const overrideMap = new Map<
        string,
        { alternativeItemId: string; notes?: string }
      >(
        savedOverrides
          .filter((ov: any) => ov?.originalItemId && ov?.alternativeItemId)
          .map((ov: any) => [
            ov.originalItemId,
            {
              alternativeItemId: ov.alternativeItemId,
              notes: ov.notes,
            },
          ]),
      );
      const reverseOverrideMap = new Map<string, string>(
        savedOverrides
          .filter((ov: any) => ov?.originalItemId && ov?.alternativeItemId)
          .map((ov: any) => [ov.alternativeItemId, ov.originalItemId]),
      );

      const itemIds = Array.from(
        new Set(
          materials
            .flatMap((m) => [m.itemId, (m as any).originalItemId])
            .filter(Boolean),
        ),
      );
      if (itemIds.length > 0) {
        const items = await this.dataSource.query(
          `SELECT id, sku, item_name FROM public.erp_inventory_items WHERE id = ANY($1::uuid[])`,
          [itemIds],
        );
        const itemMap = new Map(items.map((i: any) => [i.id, i]));
        for (const mat of materials) {
          const originalItemId = reverseOverrideMap.get(mat.itemId) ?? null;
          const matchedOverride = originalItemId
            ? overrideMap.get(originalItemId)
            : null;
          const alternativeItemId = matchedOverride?.alternativeItemId ?? null;

          (mat as any).originalItemId = originalItemId;
          (mat as any).alternativeItemId = alternativeItemId;
          (mat as any).alternativeNotes = matchedOverride?.notes ?? null;

          if (mat.itemId && itemMap.has(mat.itemId)) {
            const item = itemMap.get(mat.itemId) as any;
            (mat as any).itemCode = item.sku;
            (mat as any).itemName = item.item_name;
          }

          if (originalItemId && itemMap.has(originalItemId)) {
            const originalItem = itemMap.get(originalItemId) as any;
            (mat as any).originalItemCode = originalItem.sku;
            (mat as any).originalItemName = originalItem.item_name;
          }
        }
      }
    }

    return {
      message: 'Lấy thông tin thành công',
      data: {
        ...data,
        finishedGoodItemCode,
        finishedGoodItemName,
        finishedGoodItem: data.finishedGoodItemId
          ? {
              id: data.finishedGoodItemId,
              itemCode: finishedGoodItemCode,
              itemName: finishedGoodItemName,
              trackingPolicy: finishedGoodItemTrackingPolicy,
            }
          : null,
        producedVehicles,
        producedSerials,
        materials,
      },
    };
  }

  private async explodeBom(
    bomId: string,
    factor: number,
    bomRepo: Repository<ErpBom>,
    bomLineRepo: Repository<ErpBomLine>,
    exploded: Map<string, { itemId: string; qtyRequired: number }>,
    treeNodes: any[],
    rootFinishedGoodId?: string | null,
    stack: string[] = [],
    pathPrefix: string = 'root',
  ) {
    if (stack.includes(bomId)) {
      throw new BadRequestException(
        `Phát hiện vòng lặp BOM: ${[...stack, bomId].join(' -> ')}`,
      );
    }
    const nextStack = [...stack, bomId];

    const lines = await bomLineRepo.find({
      where: { bomId },
      order: { lineNo: 'ASC' },
    });

    const componentItemIds = lines
      .map((l) => l.componentItemId)
      .filter(Boolean) as string[];

    const childBoms = componentItemIds.length
      ? await bomRepo.find({
          where: { finishedGoodItemId: In(componentItemIds), status: 'ACTIVE' },
        })
      : [];
    const childBomMap = new Map(
      childBoms.map((b) => [b.finishedGoodItemId, b]),
    );

    for (const line of lines) {
      if (!line.componentItemId) continue;
      const baseQty = Number(line.qtyRequired || 0);
      const scrapRate = Number(line.scrapRate || 0);
      const grossQty = baseQty * factor * (1 + scrapRate / 100);
      if (grossQty <= 0) continue;

      const currentPath = `${pathPrefix}/${line.id}`;
      const childBom = childBomMap.get(line.componentItemId);

      if (childBom) {
        if (childBom.finishedGoodItemId === rootFinishedGoodId) {
          throw new BadRequestException(
            `BOM nhiều cấp tự quay về thành phẩm gốc ${rootFinishedGoodId}`,
          );
        }
        const childTreeNodes: any[] = [];
        await this.explodeBom(
          childBom.id,
          grossQty,
          bomRepo,
          bomLineRepo,
          exploded,
          childTreeNodes,
          rootFinishedGoodId,
          nextStack,
          currentPath,
        );
        treeNodes.push({
          path: currentPath,
          itemId: line.componentItemId,
          qtyRequired: grossQty,
          isLeaf: false,
          children: childTreeNodes,
        });
        continue;
      }

      const current = exploded.get(line.componentItemId);
      exploded.set(line.componentItemId, {
        itemId: line.componentItemId,
        qtyRequired: (current?.qtyRequired || 0) + grossQty,
      });
      treeNodes.push({
        path: currentPath,
        itemId: line.componentItemId,
        qtyRequired: grossQty,
        isLeaf: true,
      });
    }
  }

  async cancel(id: string) {
    const existing = await this.productionOrderRepository.findOne({
      where: { id, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy lệnh sản xuất');
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Lệnh sản xuất đã bị hủy');
    }
    if (existing.status === 'DRAFT') {
      throw new BadRequestException(
        'Lệnh sản xuất DRAFT phải dùng thao tác xóa, không dùng hủy',
      );
    }

    // Basic cancellation: just update status. Reversing inventory requires complex transaction reversals.
    existing.status = 'CANCELLED';
    await this.productionOrderRepository.save(existing);

    return {
      message: 'Hủy thành công (chỉ cập nhật trạng thái)',
      data: { id },
    };
  }

  async remove(id: string) {
    const existing = await this.productionOrderRepository.findOne({
      where: { id, isDeleted: false },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy lệnh sản xuất');
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        'Chỉ được xóa lệnh sản xuất ở trạng thái DRAFT',
      );
    }

    await this.productionOrderRepository.update(id, { isDeleted: true } as any);

    return {
      message: 'Xóa lệnh sản xuất nháp thành công',
      data: { id },
    };
  }

  async updateDraft(id: string, dto: ExecuteProductionDto) {
    return this.dataSource.transaction(async (manager) => {
      const productionRepo = manager.getRepository(ErpProductionOrder);
      const materialRepo = manager.getRepository(ErpProductionOrderMaterial);
      const bomRepo = manager.getRepository(ErpBom);
      const bomLineRepo = manager.getRepository(ErpBomLine);
      const itemRepo = manager.getRepository(ErpInventoryItem);

      const existing = await productionRepo.findOne({
        where: { id, isDeleted: false },
      });

      if (!existing) {
        throw new NotFoundException('Không tìm thấy lệnh sản xuất');
      }

      if (existing.status !== 'DRAFT') {
        // ALLOW updating outputMetadata and planned dates for non-draft orders
        existing.plannedStartDate =
          dto.plannedStartDate ?? existing.plannedStartDate;
        existing.plannedEndDate = dto.plannedEndDate ?? existing.plannedEndDate;
        existing.outputMetadata = {
          ...(existing.outputMetadata ?? {}),
          ...(dto.outputMetadata ?? {}),
          bomId: dto.bomId ?? existing.outputMetadata?.bomId,
        } as any;

        const savedOrder = await productionRepo.save(existing);

        // return early without modifying materials
        return {
          message: 'Cập nhật lệnh sản xuất thành công',
          data: savedOrder,
        };
      }

      const qtyToProduce = Number(dto.qtyToProduce || 0);
      if (!Number.isFinite(qtyToProduce) || qtyToProduce <= 0) {
        throw new BadRequestException('Số lượng sản xuất phải lớn hơn 0');
      }

      const bom = dto.bomId
        ? await bomRepo.findOne({
            where: {
              id: dto.bomId,
              finishedGoodItemId: dto.finishedGoodItemId,
            },
          })
        : await bomRepo.findOne({
            where: {
              finishedGoodItemId: dto.finishedGoodItemId,
              status: 'ACTIVE',
            },
            order: { createdAt: 'DESC' },
          });
      if (!bom) {
        throw new NotFoundException(
          dto.bomId
            ? 'Không tìm thấy BOM theo id đã chọn cho thành phẩm này'
            : 'Không tìm thấy BOM ACTIVE cho thành phẩm cần sản xuất',
        );
      }

      const exploded = new Map<
        string,
        { itemId: string; qtyRequired: number }
      >();
      const explosionTree: any[] = [];
      await this.explodeBom(
        bom.id,
        qtyToProduce,
        bomRepo,
        bomLineRepo,
        exploded,
        explosionTree,
        dto.finishedGoodItemId,
      );

      const overrideMap = new Map(
        (dto.materialOverrides ?? [])
          .filter((ov) => ov?.originalItemId && ov?.alternativeItemId)
          .map((ov) => [ov.originalItemId, ov]),
      );

      const finalMaterials = Array.from(exploded.values()).map((material) => {
        const override = overrideMap.get(material.itemId);
        return {
          itemId: override?.alternativeItemId ?? material.itemId,
          originalItemId: override?.originalItemId ?? material.itemId,
          qtyRequired: material.qtyRequired,
          alternativeNotes: override?.notes ?? null,
        };
      });

      const collectTreeItemIds = (nodes: any[], set: Set<string>) => {
        for (const node of nodes) {
          set.add(node.itemId);
          if (node.children) collectTreeItemIds(node.children, set);
        }
      };

      const allItemIds = new Set<string>(finalMaterials.map((m) => m.itemId));
      collectTreeItemIds(explosionTree, allItemIds);
      allItemIds.add(dto.finishedGoodItemId);

      const inventoryItems = await itemRepo.find({
        where: { id: In(Array.from(allItemIds)) },
      });
      const inventoryItemMap = new Map(
        inventoryItems.map((item) => [item.id, item]),
      );

      const populateTreeItems = (nodes: any[]) => {
        for (const node of nodes) {
          const item = inventoryItemMap.get(node.itemId);
          if (item) {
            node.itemName = item.itemName;
            node.itemCode = item.sku;
            node.uom = item.uom;
          }
          if (node.children) populateTreeItems(node.children);
        }
      };
      populateTreeItems(explosionTree);

      const finishedGoodItem = inventoryItemMap.get(dto.finishedGoodItemId);

      await materialRepo.delete({ productionOrderId: id });

      const materialPayloads: DeepPartial<ErpProductionOrderMaterial>[] =
        finalMaterials.map((material) => ({
          productionOrderId: id,
          itemId: material.itemId,
          qtyRequired: material.qtyRequired.toFixed(3),
          unitCost: '0.000',
          amount: '0.000',
        }));

      const savedMaterialEntities = await materialRepo.save(materialPayloads);

      existing.referenceNo = dto.referenceNo?.trim() || existing.referenceNo;
      existing.finishedGoodItemId = dto.finishedGoodItemId;
      existing.qtyToProduce = qtyToProduce.toFixed(3) as any;
      existing.warehouseCode = dto.warehouseCode ?? null;
      existing.plannedStartDate = dto.plannedStartDate ?? null;
      existing.plannedEndDate = dto.plannedEndDate ?? null;
      existing.outputMetadata = {
        ...(dto.outputMetadata ?? {}),
        materialOverrides: dto.materialOverrides ?? [],
        explosionTree,
        bomId: bom.id,
      } as any;
      existing.status = 'DRAFT';

      const savedOrder = await productionRepo.save(existing);

      const savedMaterials = savedMaterialEntities.map((entity, idx) => {
        const src = finalMaterials[idx];
        const materialItem = inventoryItemMap.get(src.itemId);
        return {
          ...entity,
          itemName: materialItem?.itemName ?? null,
          uom: materialItem?.uom ?? null,
          originalItemId: src.originalItemId ?? null,
          alternativeItemId:
            src.originalItemId && src.originalItemId !== src.itemId
              ? src.itemId
              : null,
          alternativeNotes: src.alternativeNotes ?? null,
        };
      });

      return {
        message: 'Cập nhật MO nháp thành công',
        data: {
          ...savedOrder,
          finishedGoodItemName: finishedGoodItem?.itemName ?? null,
          materials: savedMaterials,
        },
      };
    });
  }

  async confirmOrder(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const productionRepo = manager.getRepository(ErpProductionOrder);
      const materialRepo = manager.getRepository(ErpProductionOrderMaterial);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const itemRepo = manager.getRepository(ErpInventoryItem);

      const order = await productionRepo.findOne({
        where: { id },
      });

      if (!order) {
        throw new NotFoundException(`Production order ${id} not found`);
      }

      if (order.status !== 'DRAFT') {
        throw new BadRequestException(
          `Chỉ có thể xác nhận lệnh ở trạng thái DRAFT`,
        );
      }

      const materials = await materialRepo.find({
        where: { productionOrderId: id },
      });

      if (!materials.length) {
        throw new BadRequestException('Lệnh sản xuất không có nguyên vật liệu');
      }

      const materialItemIds = Array.from(
        new Set(materials.map((m) => m.itemId)),
      );

      const inventoryItems = await itemRepo.find({
        where: { id: In(materialItemIds) },
      });
      const inventoryItemMap = new Map(
        inventoryItems.map((item) => [item.id, item]),
      );

      const balances = await balanceRepo.find({
        where: {
          itemId: In(materialItemIds),
          ...(order.warehouseCode
            ? { warehouseCode: order.warehouseCode }
            : {}),
        },
      });
      const balanceMap = new Map(balances.map((b) => [b.itemId, b]));

      const balancesToSave: ErpInventoryBalance[] = [];

      for (const material of materials) {
        const balance = balanceMap.get(material.itemId);
        if (!balance) {
          const materialLabel = this.formatInventoryItemLabel(
            inventoryItemMap.get(material.itemId),
            material.itemId,
          );
          throw new BadRequestException(
            `Không tìm thấy tồn kho cho NVL ${materialLabel}`,
          );
        }

        const currentQty = Number(balance.qtyOnHand || 0);
        const currentReserved = Number(balance.qtyReserved || 0);
        const availableQty = currentQty - currentReserved;
        const qtyRequired = Number(material.qtyRequired || 0);

        if (availableQty < qtyRequired) {
          const materialLabel = this.formatInventoryItemLabel(
            inventoryItemMap.get(material.itemId),
            material.itemId,
          );
          throw new BadRequestException(
            `Tồn khả dụng không đủ cho NVL ${materialLabel}. Cần ${qtyRequired.toFixed(3)}, có ${availableQty.toFixed(3)}`,
          );
        }

        balance.qtyReserved = (currentReserved + qtyRequired).toFixed(3);
        balancesToSave.push(balance);
      }

      await balanceRepo.save(balancesToSave);

      order.status = 'CONFIRMED';
      const updatedOrder = await productionRepo.save(order);

      return {
        message: 'Xác nhận lệnh sản xuất thành công',
        data: updatedOrder,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // START PRODUCTION — auto-issue NVL proportionally + move MO to IN_PROGRESS
  // ─────────────────────────────────────────────────────────────────────────────
  async startProduction(id: string, dto: StartProductionDto) {
    return this.dataSource.transaction(async (manager) => {
      const productionRepo = manager.getRepository(ErpProductionOrder);
      const materialRepo = manager.getRepository(ErpProductionOrderMaterial);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const txnRepo = manager.getRepository(ErpInventoryTransaction);
      const giRepo = manager.getRepository(ErpGoodsIssue);
      const giLineRepo = manager.getRepository(ErpGoodsIssueLine);
      const itemRepo = manager.getRepository(ErpInventoryItem);

      const order = await productionRepo.findOne({
        where: { id, isDeleted: false },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Không tìm thấy lệnh sản xuất');
      if (!['CONFIRMED', 'IN_PROGRESS'].includes(order.status)) {
        throw new BadRequestException(
          'Chỉ có thể bắt đầu sản xuất cho lệnh ở trạng thái CONFIRMED hoặc IN_PROGRESS',
        );
      }

      const qtyToProduce = Number(order.qtyToProduce || 0);
      const qtyToManufacture = Number(dto.qtyToManufacture);
      if (qtyToManufacture <= 0) {
        throw new BadRequestException('Số lượng sản xuất phải lớn hơn 0');
      }

      const materials = await materialRepo.find({
        where: { productionOrderId: id },
      });
      if (!materials.length) {
        throw new BadRequestException('Lệnh sản xuất không có nguyên vật liệu');
      }

      const materialItemIds = Array.from(
        new Set(materials.map((m) => m.itemId)),
      );
      const warehouseCode =
        dto.warehouseCode ?? order.warehouseCode ?? undefined;

      const balances = await balanceRepo.find({
        where: {
          itemId: In(materialItemIds),
          ...(warehouseCode ? { warehouseCode } : {}),
        },
      });
      const balanceMap = new Map(balances.map((b) => [b.itemId, b]));

      const inventoryItems = materialItemIds.length
        ? await itemRepo.find({
            where: { id: In(materialItemIds) },
            relations: ['itemType'],
          })
        : [];
      const itemMap = new Map(inventoryItems.map((i) => [i.id, i]));

      // Validate stock availability for proportional qty
      const proportion = qtyToManufacture / qtyToProduce;
      for (const mat of materials) {
        const qtyRequired = Number(mat.qtyRequired || 0);
        const qtyIssued = Number(mat.qtyIssued || 0);
        const qtyNeeded = parseFloat((qtyRequired * proportion).toFixed(3));
        const remaining = parseFloat((qtyRequired - qtyIssued).toFixed(3));
        const toIssue = Math.min(qtyNeeded, remaining);
        if (toIssue <= 0) continue;

        const item = itemMap.get(mat.itemId);
        if (item?.itemType?.code === 'SERVICE') {
          continue;
        }

        const balance = balanceMap.get(mat.itemId);
        const availableQty = balance
          ? Number(balance.qtyOnHand || 0) - Number(balance.qtyReserved || 0)
          : 0;
        if (availableQty < toIssue - 0.0005) {
          const itemLabel = this.formatInventoryItemLabel(
            itemMap.get(mat.itemId),
            mat.itemId,
          );
          throw new BadRequestException(
            `Tồn khả dụng không đủ cho NVL ${itemLabel}. Cần ${toIssue.toFixed(3)}, có ${availableQty.toFixed(3)}`,
          );
        }
      }

      // Generate GI number
      const today = new Date();
      const ym = getGMT7YearMonthString(today);
      const giPrefix = `XK-${ym}`;
      const latestGi = await giRepo
        .createQueryBuilder('gi')
        .where('gi.issueNo LIKE :prefix', { prefix: `${giPrefix}%` })
        .orderBy('LENGTH(gi.issueNo)', 'DESC')
        .addOrderBy('gi.issueNo', 'DESC')
        .getOne();
      const latestSeq = latestGi?.issueNo?.slice(giPrefix.length) ?? '000';
      const giNo = `${giPrefix}${String(Number(latestSeq || '0') + 1).padStart(3, '0')}`;

      const issueDate = today.toISOString();
      const gi = (await giRepo.save(
        giRepo.create({
          issueNo: giNo,
          issueDate,
          issueType: 'PRODUCTION',
          productionOrderId: id,
          status: 'POSTED',
          remarks: `Xuất NVL sản xuất ${order.referenceNo} — ${qtyToManufacture} SP`,
        } as any),
      )) as unknown as ErpGoodsIssue;

      let lineNo = 1;
      const updatedMaterials: ErpProductionOrderMaterial[] = [];
      const giLinesToSave: any[] = [];
      const balancesToSave: any[] = [];
      const txnsToSave: any[] = [];

      for (const mat of materials) {
        const qtyRequired = Number(mat.qtyRequired || 0);
        const qtyIssued = Number(mat.qtyIssued || 0);
        const qtyNeeded = parseFloat((qtyRequired * proportion).toFixed(3));
        const remaining = parseFloat((qtyRequired - qtyIssued).toFixed(3));
        const toIssue = parseFloat(Math.min(qtyNeeded, remaining).toFixed(3));
        if (toIssue <= 0) {
          lineNo++;
          continue;
        }

        // GI line
        giLinesToSave.push(
          giLineRepo.create({
            goodsIssueId: gi.id,
            lineNo: lineNo++,
            productionOrderMaterialId: mat.id,
            itemId: mat.itemId,
            qtyIssued: toIssue.toFixed(3),
            salesOrderLineId: null,
            serialId: null,
            vehicleId: null,
          } as any),
        );

        const item = itemMap.get(mat.itemId);
        const isService = item?.itemType?.code === 'SERVICE';

        const balance = balanceMap.get(mat.itemId);
        const unitCost = Number(balance?.avgUnitCost || 0);

        if (!isService) {
          // Inventory: deduct on-hand + reserved
          if (balance) {
            const newOnHand = Math.max(
              0,
              Number(balance.qtyOnHand || 0) - toIssue,
            );
            const newReserved = Math.max(
              0,
              Number(balance.qtyReserved || 0) - toIssue,
            );
            balance.qtyOnHand = newOnHand.toFixed(3);
            balance.qtyReserved = newReserved.toFixed(3);
            const newValue = newOnHand * Number(balance.avgUnitCost || 0);
            balance.inventoryValue = newValue.toFixed(3);
            balancesToSave.push(balance);
          }

          txnsToSave.push(
            txnRepo.create({
              transactionType: 'ISSUE',
              documentType: 'GOODS_ISSUE',
              documentId: gi.id,
              itemId: mat.itemId,
              warehouseCode: warehouseCode ?? null,
              qtyIn: '0.000',
              qtyOut: toIssue.toFixed(3),
              unitCost: unitCost.toFixed(3),
              transactionDate: issueDate,
              notes: `Auto GI cho LSX ${order.referenceNo}`,
              createdBy: null,
            } as any),
          );
        }

        // Update material qty_issued
        mat.qtyIssued = (qtyIssued + toIssue).toFixed(3) as any;
        updatedMaterials.push(mat);
      }

      if (giLinesToSave.length > 0) await giLineRepo.save(giLinesToSave);
      if (balancesToSave.length > 0) await balanceRepo.save(balancesToSave);
      if (txnsToSave.length > 0) await txnRepo.save(txnsToSave);
      if (updatedMaterials.length > 0)
        await materialRepo.save(updatedMaterials);

      // Transition status
      if (order.status === 'CONFIRMED') {
        order.status = 'IN_PROGRESS';
        await productionRepo.save(order);
      }

      return {
        message: 'Bắt đầu sản xuất thành công',
        data: {
          id: order.id,
          referenceNo: order.referenceNo,
          status: order.status,
          goodsIssueId: gi.id,
          goodsIssueNo: gi.issueNo,
          qtyToManufacture,
        },
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // COMPLETE PRODUCTION — auto-receipt thành phẩm + cập nhật qtyProduced + status
  // ─────────────────────────────────────────────────────────────────────────────
  async completeProduction(id: string, dto: CompleteProductionDto) {
    return this.dataSource.transaction(async (manager) => {
      const productionRepo = manager.getRepository(ErpProductionOrder);
      const materialRepo = manager.getRepository(ErpProductionOrderMaterial);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const txnRepo = manager.getRepository(ErpInventoryTransaction);
      const grRepo = manager.getRepository(ErpGoodsReceipt);
      const grLineRepo = manager.getRepository(ErpGoodsReceiptLine);
      const itemRepo = manager.getRepository(ErpInventoryItem);
      const serialRepo = manager.getRepository(ErpInventoryTrackingSerial);
      const vehicleRepo = manager.getRepository(ErpVehicle);

      const order = await productionRepo.findOne({
        where: { id, isDeleted: false },
      });
      if (!order) throw new NotFoundException('Không tìm thấy lệnh sản xuất');
      if (order.status !== 'IN_PROGRESS') {
        throw new BadRequestException(
          'Chỉ có thể hoàn thành lệnh ở trạng thái IN_PROGRESS',
        );
      }

      const qtyToProduce = Number(order.qtyToProduce || 0);
      const qtyProducedSoFar = Number(order.qtyProduced || 0);
      const qtyFinished = Number(dto.qtyFinished);

      if (qtyFinished <= 0)
        throw new BadRequestException('Số lượng hoàn thành phải lớn hơn 0');
      if (qtyProducedSoFar + qtyFinished > qtyToProduce + 0.0005) {
        throw new BadRequestException(
          `Số lượng hoàn thành vượt quá kế hoạch. Còn lại ${(qtyToProduce - qtyProducedSoFar).toFixed(3)}`,
        );
      }

      // Check all materials issued before completing
      const materials = await materialRepo.find({
        where: { productionOrderId: id },
      });
      const unissuedMaterial = materials.find((m) => {
        const required = Number(m.qtyRequired || 0);
        const issued = Number(m.qtyIssued || 0);
        return required > 0 && issued + 0.0005 < required;
      });
      if (unissuedMaterial) {
        throw new BadRequestException(
          'Chưa xuất đủ nguyên vật liệu cho lệnh sản xuất, không thể nhập thành phẩm',
        );
      }

      const warehouseCode =
        dto.warehouseCode ?? order.warehouseCode ?? undefined;
      const receiptDate = new Date().toISOString();

      // Load finished good item to check tracking policy
      const finishedGoodItem = await itemRepo.findOne({
        where: { id: order.finishedGoodItemId },
        relations: ['trackingPolicy'],
      });
      const trackingPolicy = (finishedGoodItem?.trackingPolicy?.code ??
        'NONE') as 'NONE' | 'SERIAL' | 'LOT' | 'VEHICLE' | 'CUSTOM';
      const identifiers = dto.identifiers ?? [];

      if (!['NONE', 'CUSTOM'].includes(trackingPolicy)) {
        if (!Number.isInteger(qtyFinished)) {
          throw new BadRequestException(
            'Mặt hàng có tracking policy bắt buộc số lượng hoàn thành là số nguyên',
          );
        }
        if (identifiers.length !== qtyFinished) {
          throw new BadRequestException(
            `Số lượng mã định danh phải bằng số lượng hoàn thành (cần ${qtyFinished}, nhận được ${identifiers.length})`,
          );
        }
      }
      if (trackingPolicy === 'VEHICLE') {
        const seenVins = new Set<string>();
        const seenEngineNos = new Set<string>();
        identifiers.forEach((identifier, index) => {
          const vinNo = identifier.vinNo?.trim();
          const engineNo = identifier.engineNo?.trim();
          if (!vinNo || !engineNo) {
            throw new BadRequestException(
              `Thiếu VIN hoặc số máy tại mã định danh ${index + 1}`,
            );
          }
          const vinKey = vinNo.toUpperCase();
          const engineKey = engineNo.toUpperCase();
          if (seenVins.has(vinKey)) {
            throw new BadRequestException(
              `Số VIN bị trùng trong danh sách: ${vinNo}`,
            );
          }
          if (seenEngineNos.has(engineKey)) {
            throw new BadRequestException(
              `Số máy bị trùng trong danh sách: ${engineNo}`,
            );
          }
          seenVins.add(vinKey);
          seenEngineNos.add(engineKey);
          identifier.vinNo = vinNo;
          identifier.engineNo = engineNo;
        });

        const existingVehicles = await vehicleRepo
          .createQueryBuilder('vehicle')
          .select([
            'vehicle.vinNo AS "vinNo"',
            'vehicle.engineNo AS "engineNo"',
          ])
          .where('UPPER(vehicle.vinNo) IN (:...vinKeys)', {
            vinKeys: Array.from(seenVins),
          })
          .orWhere('UPPER(vehicle.engineNo) IN (:...engineKeys)', {
            engineKeys: Array.from(seenEngineNos),
          })
          .getRawMany<{ vinNo: string | null; engineNo: string | null }>();

        const duplicatedVin = existingVehicles.find(
          (row) => row.vinNo && seenVins.has(row.vinNo.toUpperCase()),
        )?.vinNo;
        if (duplicatedVin) {
          throw new BadRequestException(`Số VIN đã tồn tại: ${duplicatedVin}`);
        }

        const duplicatedEngineNo = existingVehicles.find(
          (row) =>
            row.engineNo && seenEngineNos.has(row.engineNo.toUpperCase()),
        )?.engineNo;
        if (duplicatedEngineNo) {
          throw new BadRequestException(
            `Số máy đã tồn tại: ${duplicatedEngineNo}`,
          );
        }
      }
      if (trackingPolicy === 'SERIAL') {
        identifiers.forEach((identifier, index) => {
          if (!identifier.serialNo) {
            throw new BadRequestException(
              `Thiếu serial number tại mã định danh ${index + 1}`,
            );
          }
        });
      }
      if (trackingPolicy === 'LOT') {
        identifiers.forEach((identifier, index) => {
          if (!identifier.lotNo) {
            throw new BadRequestException(
              `Thiếu lot number tại mã định danh ${index + 1}`,
            );
          }
        });
      }
      const today = new Date();
      const ym = getGMT7YearMonthString(today);
      const grPrefix = `NK-${ym}`;
      const latestGr = await grRepo
        .createQueryBuilder('gr')
        .where('gr.receiptNo LIKE :prefix', { prefix: `${grPrefix}%` })
        .orderBy('gr.receiptNo', 'DESC')
        .getOne();
      const latestSeq = latestGr?.receiptNo?.slice(grPrefix.length) ?? '000';
      const grNo = `${grPrefix}${String(Number(latestSeq || '0') + 1).padStart(3, '0')}`;

      const gr = (await grRepo.save(
        grRepo.create({
          receiptNo: grNo,
          productionOrderId: id,
          receiptDate,
          status: 'POSTED',
          remarks: `Nhập thành phẩm LSX ${order.referenceNo} — ${qtyFinished} SP`,
          supplierId: null,
          purchaseOrderId: null,
        } as any),
      )) as unknown as ErpGoodsReceipt;

      const unitCost = Number(dto.unitCost ?? 0);
      const savedGrLine = (await grLineRepo.save(
        grLineRepo.create({
          goodsReceiptId: gr.id,
          lineNo: 1,
          itemId: order.finishedGoodItemId,
          qtyReceived: qtyFinished.toFixed(3),
          unitCost: unitCost.toFixed(3),
          amount: (qtyFinished * unitCost).toFixed(3),
          purchaseOrderLineId: null,
        } as any),
      )) as unknown as ErpGoodsReceiptLine;

      if (trackingPolicy === 'VEHICLE') {
        for (const identifier of identifiers) {
          const vehicle = (await vehicleRepo.save(
            vehicleRepo.create({
              vinNo: identifier.vinNo,
              engineNo: identifier.engineNo,
              finishedGoodItemId: order.finishedGoodItemId,
              productionOrderId: order.id,
              assemblyDate: receiptDate,
              status: 'ASSEMBLED',
              notes: identifier.notes ?? null,
            } as any),
          )) as unknown as ErpVehicle;

          await serialRepo.save(
            serialRepo.create({
              itemId: order.finishedGoodItemId,
              serialNo: identifier.engineNo,
              status: 'IN_STOCK',
              vinId: vehicle.id,
              receiptLineId: savedGrLine.id,
              productionOrderId: order.id,
              salesOrderLineId: null,
              goodsIssueLineId: null,
            } as any),
          );
        }
      }

      if (trackingPolicy === 'SERIAL') {
        for (const identifier of identifiers) {
          await serialRepo.save(
            serialRepo.create({
              itemId: order.finishedGoodItemId,
              serialNo: identifier.serialNo,
              status: 'IN_STOCK',
              vinId: null,
              receiptLineId: savedGrLine.id,
              productionOrderId: order.id,
              salesOrderLineId: null,
              goodsIssueLineId: null,
            } as any),
          );
        }
      }

      // Inventory balance update for finished good
      const balanceWhere: any = {
        itemId: order.finishedGoodItemId,
        ...(warehouseCode ? { warehouseCode } : {}),
      };
      let fgBalance: ErpInventoryBalance | null = await balanceRepo.findOne({
        where: balanceWhere,
      });
      const currentQty = Number(fgBalance?.qtyOnHand || 0);
      const currentValue = Number(fgBalance?.inventoryValue || 0);
      const newValue = currentValue + qtyFinished * unitCost;
      const newQty = currentQty + qtyFinished;
      const newAvgCost = newQty > 0 ? newValue / newQty : 0;

      if (!fgBalance) {
        const saved = (await balanceRepo.save(
          balanceRepo.create({
            itemId: order.finishedGoodItemId,
            warehouseCode: warehouseCode ?? null,
            qtyOnHand: newQty.toFixed(3),
            qtyReserved: '0.000',
            avgUnitCost: newAvgCost.toFixed(3),
            inventoryValue: newValue.toFixed(3),
          } as any),
        )) as unknown as ErpInventoryBalance;
        fgBalance = saved;
      } else {
        fgBalance.qtyOnHand = newQty.toFixed(3);
        fgBalance.avgUnitCost = newAvgCost.toFixed(3);
        fgBalance.inventoryValue = newValue.toFixed(3);
        await balanceRepo.save(fgBalance);
      }

      await txnRepo.save(
        txnRepo.create({
          transactionType: 'RECEIPT',
          documentType: 'GOODS_RECEIPT',
          documentId: gr.id,
          itemId: order.finishedGoodItemId,
          warehouseCode: warehouseCode ?? null,
          qtyIn: qtyFinished.toFixed(3),
          qtyOut: '0.000',
          unitCost: unitCost.toFixed(3),
          transactionDate: receiptDate,
          notes: `Auto GR cho LSX ${order.referenceNo}`,
          createdBy: null,
        } as any),
      );

      // Update MO qty_produced + status
      const newQtyProduced = parseFloat(
        (qtyProducedSoFar + qtyFinished).toFixed(3),
      );
      const isFullyComplete = newQtyProduced >= qtyToProduce - 0.0005;
      order.qtyProduced = newQtyProduced.toFixed(3) as any;
      order.status = isFullyComplete ? 'COMPLETED' : 'IN_PROGRESS';
      const savedOrder = await productionRepo.save(order);

      return {
        message: isFullyComplete
          ? 'Hoàn thành sản xuất'
          : 'Ghi nhận sản phẩm thành công',
        data: {
          id: savedOrder.id,
          referenceNo: savedOrder.referenceNo,
          status: savedOrder.status,
          qtyToProduce: savedOrder.qtyToProduce,
          qtyProduced: savedOrder.qtyProduced,
          goodsReceiptId: gr.id,
          goodsReceiptNo: gr.receiptNo,
          finishedGoodItemId: order.finishedGoodItemId,
          finishedGoodItemName: finishedGoodItem?.itemName ?? null,
          qtyFinished,
        },
      };
    });
  }
}
