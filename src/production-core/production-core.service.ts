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
import { ErpProductionOrderMaterial } from './entities/erp_production_order_material.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpGoodsIssue } from '../goods-issues-core/entities/erp_goods_issue.entity';
import { ErpGoodsIssueLine } from '../goods-issues-core/entities/erp_goods_issue_line.entity';

import { ListProductionDto } from './dto/list-production.dto';

@Injectable()
export class ProductionCoreService {
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
  ) {}

  async findOrders(query: ListProductionDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const order = resolveSortOrder(query.sort, {
      allowedFields: ['createdAt', 'referenceNo', 'status', 'plannedStartDate'],
      columnMap: {
        created_at: 'createdAt',
        reference_no: 'referenceNo',
        planned_start_date: 'plannedStartDate',
      },
      defaultOrder: { createdAt: 'DESC' },
    });

    const whereCondition: any = { isDeleted: false };
    if (query.search) {
      whereCondition.referenceNo = ILike(`%${query.search}%`);
    }
    if (query.status) {
      whereCondition.status = query.status;
    }
    if (query.finishedGoodItemId) {
      whereCondition.finishedGoodItemId = query.finishedGoodItemId;
    }
    if (query.dateFrom || query.dateTo) {
      if (query.dateFrom && query.dateTo) {
        whereCondition.plannedStartDate = Between(query.dateFrom, query.dateTo);
      } else if (query.dateFrom) {
        whereCondition.plannedStartDate = MoreThanOrEqual(query.dateFrom);
      } else {
        whereCondition.plannedStartDate = LessThanOrEqual(query.dateTo);
      }
    }

    const [items, total] = await this.productionOrderRepository.findAndCount({
      where: whereCondition,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order,
    });

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

  async execute(dto: ExecuteProductionDto) {
    return this.dataSource.transaction(async (manager) => {
      const bomRepo = manager.getRepository(ErpBom);
      const bomLineRepo = manager.getRepository(ErpBomLine);
      const balanceRepo = manager.getRepository(ErpInventoryBalance);
      const productionRepo = manager.getRepository(ErpProductionOrder);
      const materialRepo = manager.getRepository(ErpProductionOrderMaterial);
      const itemRepo = manager.getRepository(ErpInventoryItem);

      const rootBom = await bomRepo.findOne({
        where: { finishedGoodItemId: dto.finishedGoodItemId, status: 'ACTIVE' },
        order: { createdAt: 'DESC' },
      });
      if (!rootBom) {
        throw new BadRequestException(
          'Không tìm thấy BOM ACTIVE cho thành phẩm cần sản xuất',
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
      await this.explodeBom(
        rootBom.id,
        qtyToProduce,
        bomRepo,
        bomLineRepo,
        exploded,
        visited,
        rootBom.finishedGoodItemId,
      );
      const materials = Array.from(exploded.values());
      if (materials.length === 0) {
        throw new BadRequestException(
          'BOM không có định mức nguyên vật liệu khả dụng để xuất',
        );
      }

      const materialItemIds = Array.from(
        new Set(materials.map((material) => material.itemId).filter(Boolean)),
      ) as string[];
      const inventoryItems = materialItemIds.length
        ? await itemRepo.find({ where: { id: In(materialItemIds) } })
        : [];
      const inventoryItemMap = new Map(
        inventoryItems.map((item) => [item.id, item]),
      );
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

      for (const material of materials) {
        const existingBalance = balanceMap.get(material.itemId);
        if (!existingBalance) {
          throw new BadRequestException(
            `Không tìm thấy tồn kho cho NVL ${material.itemId}`,
          );
        }
      }

      const targetStatus = dto.status === 'DRAFT' ? 'DRAFT' : 'CONFIRMED';
      const referenceNo = dto.referenceNo?.trim() || `PROD-${Date.now()}`;
      const productionPayload: DeepPartial<ErpProductionOrder> = {
        referenceNo,
        finishedGoodItemId: dto.finishedGoodItemId,
        qtyToProduce: qtyToProduce.toFixed(3),
        warehouseCode: dto.warehouseCode ?? null,
        status: targetStatus,
        outputMetadata: dto.outputMetadata ?? null,
        plannedStartDate: dto.plannedStartDate ?? null,
        plannedEndDate: dto.plannedEndDate ?? null,
        createdBy: dto.createdBy ?? null,
      };
      const productionOrder = await productionRepo.save(productionPayload);

      const savedMaterials: any[] = [];
      const materialsToSave: DeepPartial<ErpProductionOrderMaterial>[] = [];
      const balancesToSave: ErpInventoryBalance[] = [];

      for (const material of materials) {
        const balance = balanceMap.get(material.itemId);
        const currentQty = Number(balance?.qtyOnHand || 0);
        const currentReserved = Number(balance?.qtyReserved || 0);
        const avgUnitCost = Number(balance?.avgUnitCost || 0);
        const availableQty = currentQty - currentReserved;

        if (
          targetStatus === 'CONFIRMED' &&
          availableQty < material.qtyRequired
        ) {
          const materialName =
            inventoryItemMap.get(material.itemId)?.itemName ?? material.itemId;
          throw new BadRequestException(
            `Tồn khả dụng không đủ cho NVL ${materialName}. Cần ${material.qtyRequired.toFixed(3)}, có ${availableQty.toFixed(3)}`,
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

        const materialItem = inventoryItemMap.get(material.itemId);
        savedMaterials.push({
          ...materialPayload,
          itemName: materialItem?.itemName ?? null,
          uom: materialItem?.uom ?? null,
        });

        if (targetStatus === 'CONFIRMED') {
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
    if (data.finishedGoodItemId) {
      const item = await this.dataSource.query(
        `SELECT sku, item_name FROM public.erp_inventory_items WHERE id = $1::uuid`,
        [data.finishedGoodItemId],
      );
      if (item.length > 0) {
        finishedGoodItemCode = item[0].sku;
        finishedGoodItemName = `${item[0].sku} — ${item[0].item_name}`;
      }
    }

    if (materials.length > 0) {
      const itemIds = materials.map((m) => m.itemId).filter(Boolean);
      if (itemIds.length > 0) {
        const items = await this.dataSource.query(
          `SELECT id, sku, item_name FROM public.erp_inventory_items WHERE id = ANY($1::uuid[])`,
          [itemIds],
        );
        const itemMap = new Map(items.map((i: any) => [i.id, i]));
        for (const mat of materials) {
          if (mat.itemId && itemMap.has(mat.itemId)) {
            const item = itemMap.get(mat.itemId) as any;
            (mat as any).itemCode = item.sku;
            (mat as any).itemName = `${item.sku} — ${item.item_name}`;
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
    visited: Set<string>,
    rootFinishedGoodId?: string | null,
    stack: string[] = [],
  ) {
    if (stack.includes(bomId)) {
      throw new BadRequestException(
        `Phát hiện vòng lặp BOM: ${[...stack, bomId].join(' -> ')}`,
      );
    }
    const nextStack = [...stack, bomId];
    const visitKey = `${bomId}:${factor}`;
    if (visited.has(visitKey)) {
      return;
    }
    visited.add(visitKey);

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

      const childBom = childBomMap.get(line.componentItemId);

      if (childBom) {
        if (childBom.finishedGoodItemId === rootFinishedGoodId) {
          throw new BadRequestException(
            `BOM nhiều cấp tự quay về thành phẩm gốc ${rootFinishedGoodId}`,
          );
        }
        await this.explodeBom(
          childBom.id,
          grossQty,
          bomRepo,
          bomLineRepo,
          exploded,
          visited,
          rootFinishedGoodId,
          nextStack,
        );
        continue;
      }

      const current = exploded.get(line.componentItemId);
      exploded.set(line.componentItemId, {
        itemId: line.componentItemId,
        qtyRequired: (current?.qtyRequired || 0) + grossQty,
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

    // Basic cancellation: just update status. Reversing inventory requires complex transaction reversals.
    existing.status = 'CANCELLED';
    await this.productionOrderRepository.save(existing);

    return {
      message: 'Hủy thành công (chỉ cập nhật trạng thái)',
      data: { id },
    };
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
          throw new BadRequestException(
            `Không tìm thấy tồn kho cho NVL ${material.itemId}`,
          );
        }

        const currentQty = Number(balance.qtyOnHand || 0);
        const currentReserved = Number(balance.qtyReserved || 0);
        const availableQty = currentQty - currentReserved;
        const qtyRequired = Number(material.qtyRequired || 0);

        if (availableQty < qtyRequired) {
          const materialName =
            inventoryItemMap.get(material.itemId)?.itemName ?? material.itemId;
          throw new BadRequestException(
            `Tồn khả dụng không đủ cho NVL ${materialName}. Cần ${qtyRequired.toFixed(3)}, có ${availableQty.toFixed(3)}`,
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
}
