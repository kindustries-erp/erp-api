import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, ILike, In, Repository } from 'typeorm';
import { ErpBom } from '../bom-core/entities/erp_bom.entity';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ErpBomLine } from '../bom-core/entities/erp_bom_line.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ExecuteProductionDto } from './dto/execute-production.dto';
import { ErpProductionOrder } from './entities/erp_production_order.entity';
import { ErpProductionOrderMaterial } from './entities/erp_production_order_material.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';

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

  async findOrders(query: PaginationDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [items, total] = await this.productionOrderRepository.findAndCount({
      where: query.search
        ? ([{ referenceNo: ILike(`%${query.search}%`) }] as any)
        : undefined,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
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
        qtyProduced: item.qtyToProduce,
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
      const txnRepo = manager.getRepository(ErpInventoryTransaction);
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

      for (const material of materials) {
        const existingBalance = await balanceRepo.findOne({
          where: {
            itemId: material.itemId,
            warehouseCode: dto.warehouseCode ?? undefined,
          },
        });
        if (!existingBalance) {
          throw new BadRequestException(
            `Không tìm thấy tồn kho cho NVL ${material.itemId}`,
          );
        }
      }

      const referenceNo = dto.referenceNo?.trim() || `PROD-${Date.now()}`;
      const productionPayload: DeepPartial<ErpProductionOrder> = {
        referenceNo,
        finishedGoodItemId: dto.finishedGoodItemId,
        qtyToProduce: qtyToProduce.toFixed(3),
        warehouseCode: dto.warehouseCode ?? null,
        status: 'POSTED',
        outputMetadata: dto.outputMetadata ?? null,
        createdBy: dto.createdBy ?? null,
      };
      const productionOrder = await productionRepo.save(productionPayload);

      const savedMaterials: any[] = [];
      for (const material of materials) {
        const balance = await balanceRepo.findOne({
          where: {
            itemId: material.itemId,
            warehouseCode: dto.warehouseCode ?? undefined,
          },
        });
        const currentQty = Number(balance?.qtyOnHand || 0);
        const currentReserved = Number(balance?.qtyReserved || 0);
        const currentValue = Number(balance?.inventoryValue || 0);
        const avgUnitCost = Number(balance?.avgUnitCost || 0);
        const availableQty = currentQty - currentReserved;
        if (availableQty < material.qtyRequired) {
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
        const nextQty = currentQty - material.qtyRequired;
        const nextValue = Math.max(0, currentValue - amount);
        const nextAvg = nextQty > 0 ? nextValue / nextQty : 0;

        const savedMat = await materialRepo.save(materialPayload);
        const materialItem = inventoryItemMap.get(material.itemId);
        savedMaterials.push({
          ...savedMat,
          itemName: materialItem?.itemName ?? null,
          uom: materialItem?.uom ?? null,
          qtyIssued: material.qtyRequired.toFixed(3),
          newStockQty: nextQty.toFixed(3),
        });

        const issueTxnPayload: DeepPartial<ErpInventoryTransaction> = {
          transactionType: 'ISSUE',
          documentType: 'PRODUCTION_ORDER',
          documentId: productionOrder.id,
          itemId: material.itemId,
          warehouseCode: dto.warehouseCode ?? null,
          qtyIn: '0.000',
          qtyOut: material.qtyRequired.toFixed(3),
          unitCost: avgUnitCost.toFixed(3),
          transactionDate: new Date().toISOString().slice(0, 10),
          notes: `Xuất NVL cho lệnh sản xuất ${referenceNo}`,
          createdBy: dto.createdBy ?? null,
        };
        await txnRepo.save(issueTxnPayload);
        if (!balance) {
          throw new BadRequestException(
            `Không tìm thấy tồn kho cho NVL ${material.itemId}`,
          );
        }
        balance.qtyOnHand = nextQty.toFixed(3);
        balance.inventoryValue = nextValue.toFixed(3);
        balance.avgUnitCost = nextAvg.toFixed(3);
        await balanceRepo.save(balance);
      }

      let finishedBalance = await balanceRepo.findOne({
        where: {
          itemId: dto.finishedGoodItemId,
          warehouseCode: dto.warehouseCode ?? undefined,
        },
      });
      const finishedCurrentQty = Number(finishedBalance?.qtyOnHand || 0);
      const finishedCurrentValue = Number(finishedBalance?.inventoryValue || 0);
      const finishedProducedValue = savedMaterials.reduce(
        (sum, line) => sum + Number(line.amount || 0),
        0,
      );
      const finishedNextQty = finishedCurrentQty + qtyToProduce;
      const finishedNextValue = finishedCurrentValue + finishedProducedValue;
      const finishedNextAvg =
        finishedNextQty > 0 ? finishedNextValue / finishedNextQty : 0;

      const receiptTxnPayload: DeepPartial<ErpInventoryTransaction> = {
        transactionType: 'RECEIPT',
        documentType: 'PRODUCTION_ORDER',
        documentId: productionOrder.id,
        itemId: dto.finishedGoodItemId,
        warehouseCode: dto.warehouseCode ?? null,
        qtyIn: qtyToProduce.toFixed(3),
        qtyOut: '0.000',
        unitCost:
          qtyToProduce > 0
            ? (finishedProducedValue / qtyToProduce).toFixed(3)
            : '0.000',
        transactionDate: new Date().toISOString().slice(0, 10),
        notes: `Nhập thành phẩm từ lệnh sản xuất ${referenceNo}`,
        createdBy: dto.createdBy ?? null,
      };
      await txnRepo.save(receiptTxnPayload);

      if (!finishedBalance) {
        const finishedBalancePayload: DeepPartial<ErpInventoryBalance> = {
          itemId: dto.finishedGoodItemId,
          warehouseCode: dto.warehouseCode ?? null,
          qtyOnHand: finishedNextQty.toFixed(3),
          qtyReserved: '0.000',
          avgUnitCost: finishedNextAvg.toFixed(3),
          inventoryValue: finishedNextValue.toFixed(3),
        };
        finishedBalance = await balanceRepo.save(finishedBalancePayload);
      } else {
        finishedBalance.qtyOnHand = finishedNextQty.toFixed(3);
        finishedBalance.avgUnitCost = finishedNextAvg.toFixed(3);
        finishedBalance.inventoryValue = finishedNextValue.toFixed(3);
        finishedBalance = await balanceRepo.save(finishedBalance);
      }

      return {
        message: 'Thực thi sản xuất thành công',
        data: {
          ...productionOrder,
          finishedGoodItemName: finishedGoodItem?.itemName ?? null,
          qtyProduced: qtyToProduce.toFixed(3),
          materialsIssued: savedMaterials,
          finishedGoodReceipt: {
            itemId: dto.finishedGoodItemId,
            qtyProduced: qtyToProduce.toFixed(3),
            warehouseCode: dto.warehouseCode ?? null,
            outputMetadata: dto.outputMetadata ?? null,
            newStockQty: finishedNextQty.toFixed(3),
          },
        },
      };
    });
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
    for (const line of lines) {
      if (!line.componentItemId) continue;
      const baseQty = Number(line.qtyRequired || 0);
      const scrapRate = Number(line.scrapRate || 0);
      const grossQty = baseQty * factor * (1 + scrapRate / 100);
      if (grossQty <= 0) continue;

      const childBom = await bomRepo.findOne({
        where: { finishedGoodItemId: line.componentItemId, status: 'ACTIVE' },
        order: { createdAt: 'DESC' },
      });

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
}
