import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EntityCustomFieldsHelper } from '../../module-config/helpers/entity-custom-fields.helper';
import { CreateInventoryItemDto } from '../dto/create-item.dto';
import { UpdateInventoryItemDto } from '../dto/update-item.dto';
import { ErpInventoryBalance } from '../entities/erp_inventory_balance.entity';
import { ErpInventoryItem } from '../entities/erp_inventory_item.entity';
import { ErpInventoryTransaction } from '../entities/erp_inventory_transaction.entity';
import { ErpUom } from '../entities/erp_uom.entity';
import { ErpItemType } from '../entities/erp_item_type.entity';
import { ErpTrackingPolicy } from '../entities/erp_tracking_policy.entity';

function isUuid(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str,
  );
}

function getItemTypeAliases(codeOrId?: string): string[] {
  if (!codeOrId) return [];
  const upper = codeOrId.toUpperCase().trim();
  if (upper === 'RAW' || upper === 'RAW_MATERIAL')
    return ['RAW', 'RAW_MATERIAL'];
  if (upper === 'FG' || upper === 'FINISHED' || upper === 'FINISHED_GOODS')
    return ['FG', 'FINISHED', 'FINISHED_GOODS'];
  if (upper === 'SERVICE') return ['SERVICE'];
  if (upper === 'SPARE_PART' || upper === 'PART') return ['SPARE_PART', 'PART'];
  return [upper, codeOrId];
}

@Injectable()
export class InventoryItemsLifecycleService {
  constructor(
    @InjectRepository(ErpInventoryItem)
    private readonly repository: Repository<ErpInventoryItem>,
    @InjectRepository(ErpInventoryTransaction)
    private readonly txnRepository: Repository<ErpInventoryTransaction>,
    @InjectRepository(ErpInventoryBalance)
    private readonly balanceRepository: Repository<ErpInventoryBalance>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateInventoryItemDto) {
    const customAttrs = dto.customAttributes ? { ...dto.customAttributes } : {};
    let effectiveAttributes = dto.attributes || [];
    if (effectiveAttributes.length > 0 && !customAttrs.item_features) {
      customAttrs.item_features = effectiveAttributes;
    } else if (customAttrs.item_features && effectiveAttributes.length === 0) {
      if (Array.isArray(customAttrs.item_features)) {
        effectiveAttributes = customAttrs.item_features;
      } else if (typeof customAttrs.item_features === 'string') {
        try {
          const parsed = JSON.parse(customAttrs.item_features);
          if (Array.isArray(parsed)) effectiveAttributes = parsed;
          else
            effectiveAttributes = customAttrs.item_features
              .split(',')
              .map((s) => s.trim());
        } catch {
          effectiveAttributes = customAttrs.item_features
            .split(',')
            .map((s) => s.trim());
        }
      }
    }

    const data = await this.dataSource.transaction(async (manager) => {
      // 1. Resolve uomId, itemTypeId, trackingPolicyId (hỗ trợ cả Code, Alias lẫn UUID)
      let resolvedUomId = dto.uomId;
      if (resolvedUomId) {
        const whereConditions: any[] = [
          { code: resolvedUomId.toUpperCase() },
          { code: resolvedUomId },
        ];
        if (isUuid(resolvedUomId)) {
          whereConditions.push({ id: resolvedUomId });
        }
        const uomMatch = await manager.getRepository(ErpUom).findOne({
          where: whereConditions,
        });
        if (uomMatch) resolvedUomId = uomMatch.id;
      }

      let resolvedItemTypeId = dto.itemTypeId;
      if (resolvedItemTypeId) {
        const aliases = getItemTypeAliases(resolvedItemTypeId);
        const whereConditions: any[] = aliases.map((c) => ({ code: c }));
        if (isUuid(resolvedItemTypeId)) {
          whereConditions.push({ id: resolvedItemTypeId });
        }
        const typeMatch = await manager.getRepository(ErpItemType).findOne({
          where: whereConditions,
        });
        if (typeMatch) resolvedItemTypeId = typeMatch.id;
      }

      let resolvedTrackingPolicyId = dto.trackingPolicyId;
      if (resolvedTrackingPolicyId) {
        const whereConditions: any[] = [
          { code: resolvedTrackingPolicyId.toUpperCase() },
          { code: resolvedTrackingPolicyId },
        ];
        if (isUuid(resolvedTrackingPolicyId)) {
          whereConditions.push({ id: resolvedTrackingPolicyId });
        }
        const tpMatch = await manager.getRepository(ErpTrackingPolicy).findOne({
          where: whereConditions,
        });
        if (tpMatch) resolvedTrackingPolicyId = tpMatch.id;
      }

      const itemRepo = manager.getRepository(ErpInventoryItem);
      const entity = itemRepo.create({
        ...dto,
        uomId: resolvedUomId,
        itemTypeId: resolvedItemTypeId,
        status: dto.status || 'ACTIVE',
        note: dto.note || undefined,
        trackingPolicyId: resolvedTrackingPolicyId || null,
        attributes: effectiveAttributes,
      } as Partial<ErpInventoryItem>);
      const saved = await itemRepo.save(entity);

      // Khởi tạo balance ban đầu nếu chưa có
      const balRepo = manager.getRepository(ErpInventoryBalance);
      const existingBal = await balRepo.findOne({
        where: { itemId: saved.id, warehouseCode: 'MAIN' } as never,
      });
      if (!existingBal) {
        const newBal = balRepo.create({
          itemId: saved.id,
          warehouseCode: 'MAIN',
          qtyOnHand: 0,
          qtyReserved: 0,
          avgUnitCost: 0,
          inventoryValue: 0,
        } as never);
        await balRepo.save(newBal);
      }

      // Lưu customAttributes nguyên tử trong transaction
      if (Object.keys(customAttrs).length > 0) {
        await EntityCustomFieldsHelper.saveInTx(
          manager,
          'INVENTORY_ITEM',
          saved.id,
          customAttrs,
        );
      }

      const reloaded = await itemRepo.findOne({
        where: { id: saved.id },
        relations: ['uom', 'itemType', 'trackingPolicy'],
      });

      if (reloaded) {
        await EntityCustomFieldsHelper.enrichOne(
          manager,
          'INVENTORY_ITEM',
          reloaded,
        );
      }

      return reloaded || saved;
    });

    return { message: 'Tạo thành công', data };
  }

  async findOne(id: string) {
    const data = await this.repository.findOne({
      where: { id },
      relations: ['uom', 'itemType', 'trackingPolicy'],
    });
    if (!data) throw new NotFoundException('Không tìm thấy item');
    const serialCountRes = await this.dataSource.query(
      `SELECT COUNT(1) as cnt FROM erp_inventory_tracking_serials WHERE item_id = $1`,
      [id],
    );
    const hasSerials = Number(serialCountRes[0]?.cnt || 0) > 0;
    await EntityCustomFieldsHelper.enrichOne(
      this.dataSource,
      'INVENTORY_ITEM',
      data,
    );
    return {
      message: 'Lấy thông tin thành công',
      data: { ...data, hasSerials },
    };
  }

  async update(id: string, dto: UpdateInventoryItemDto) {
    const data = await this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(ErpInventoryItem);
      const item = await itemRepo.findOneBy({ id });
      if (!item) throw new NotFoundException('Không tìm thấy item');

      if (dto.uomId !== undefined) {
        let resolvedUomId = dto.uomId;
        if (resolvedUomId) {
          const whereConditions: any[] = [
            { code: resolvedUomId.toUpperCase() },
            { code: resolvedUomId },
          ];
          if (isUuid(resolvedUomId)) {
            whereConditions.push({ id: resolvedUomId });
          }
          const uomMatch = await manager.getRepository(ErpUom).findOne({
            where: whereConditions,
          });
          if (uomMatch) resolvedUomId = uomMatch.id;
        }
        item.uomId = resolvedUomId;
      }

      if (dto.itemTypeId !== undefined) {
        let resolvedItemTypeId = dto.itemTypeId;
        if (resolvedItemTypeId) {
          const aliases = getItemTypeAliases(resolvedItemTypeId);
          const whereConditions: any[] = aliases.map((c) => ({ code: c }));
          if (isUuid(resolvedItemTypeId)) {
            whereConditions.push({ id: resolvedItemTypeId });
          }
          const typeMatch = await manager.getRepository(ErpItemType).findOne({
            where: whereConditions,
          });
          if (typeMatch) resolvedItemTypeId = typeMatch.id;
        }
        item.itemTypeId = resolvedItemTypeId;
      }

      if (dto.itemName !== undefined) item.itemName = dto.itemName;
      if (dto.sku !== undefined) item.sku = dto.sku;
      if (dto.note !== undefined) item.note = dto.note;
      if (dto.status !== undefined) item.status = dto.status;
      if (dto.trackingPolicyId !== undefined) {
        let resolvedTpId = dto.trackingPolicyId;
        if (resolvedTpId) {
          const whereConditions: any[] = [
            { code: resolvedTpId.toUpperCase() },
            { code: resolvedTpId },
          ];
          if (isUuid(resolvedTpId)) {
            whereConditions.push({ id: resolvedTpId });
          }
          const tpMatch = await manager
            .getRepository(ErpTrackingPolicy)
            .findOne({
              where: whereConditions,
            });
          if (tpMatch) resolvedTpId = tpMatch.id;
        }

        if ((resolvedTpId || null) !== (item.trackingPolicyId || null)) {
          const serialCountRes = await manager.query(
            `SELECT COUNT(1) as cnt FROM erp_inventory_tracking_serials WHERE item_id = $1`,
            [id],
          );
          const serialCount = Number(serialCountRes[0]?.cnt || 0);
          if (serialCount > 0) {
            throw new BadRequestException(
              'Mặt hàng đã phát sinh mã Serial/Tracking trong hệ thống, không thể thay đổi Tracking Policy. Vui lòng tạo mặt hàng mới nếu muốn thay đổi phương thức theo dõi.',
            );
          }
          item.trackingPolicyId = resolvedTpId || null;
        }
      }

      const customAttrsToSave = dto.customAttributes
        ? { ...dto.customAttributes }
        : undefined;

      if (dto.attributes !== undefined) {
        item.attributes = dto.attributes;
        if (customAttrsToSave && !customAttrsToSave.item_features) {
          customAttrsToSave.item_features = dto.attributes;
        }
      } else if (customAttrsToSave?.item_features !== undefined) {
        const feat = customAttrsToSave.item_features;
        if (Array.isArray(feat)) item.attributes = feat;
        else if (typeof feat === 'string') {
          try {
            const parsed = JSON.parse(feat);
            if (Array.isArray(parsed)) item.attributes = parsed;
            else item.attributes = feat.split(',').map((s) => s.trim());
          } catch {
            item.attributes = feat.split(',').map((s) => s.trim());
          }
        }
      }

      await itemRepo.save(item);

      if (customAttrsToSave) {
        await EntityCustomFieldsHelper.saveInTx(
          manager,
          'INVENTORY_ITEM',
          id,
          customAttrsToSave,
        );
      }

      const reloaded = await itemRepo.findOne({
        where: { id },
        relations: ['uom', 'itemType', 'trackingPolicy'],
      });

      if (reloaded) {
        await EntityCustomFieldsHelper.enrichOne(
          manager,
          'INVENTORY_ITEM',
          reloaded,
        );
      }

      return reloaded || item;
    });

    return { message: 'Cập nhật thành công', data };
  }

  async softDeleteItem(id: string) {
    const existing = await this.repository.findOneBy({ id });
    if (!existing)
      throw new NotFoundException(`Inventory item ${id} not found`);
    existing.isDeleted = true;
    await this.repository.save(existing);
    return { message: 'Đã xóa danh mục vật tư/kho thành công', data: { id } };
  }

  /**
   * GET /inventory/items/:id/movements
   * Returns all inventory transactions for an item sorted by date ASC,
   * with a computed `balance_after` running total at each event.
   */
  async getMovements(id: string) {
    const item = await this.repository.findOneByOrFail({ id });
    const balance = await this.balanceRepository.findOne({
      where: { itemId: id } as never,
    });
    const currentOnHand = Number(balance?.qtyOnHand ?? 0);
    const txns = await this.txnRepository
      .createQueryBuilder('txn')
      .where('txn.item_id = :itemId', { itemId: id })
      .orderBy('DATE(txn.transaction_date)', 'ASC')
      .addOrderBy('txn.created_at', 'ASC')
      .getMany();

    const receiptIds = txns
      .filter((t) => t.documentType === 'GOODS_RECEIPT' && t.documentId)
      .map((t) => t.documentId);
    const issueIds = txns
      .filter((t) => t.documentType === 'GOODS_ISSUE' && t.documentId)
      .map((t) => t.documentId);
    const adjustmentIds = txns
      .filter((t) => t.documentType === 'INVENTORY_ADJUSTMENT' && t.documentId)
      .map((t) => t.documentId);
    const productionOrderIds = txns
      .filter((t) => t.documentType === 'PRODUCTION_ORDER' && t.documentId)
      .map((t) => t.documentId);

    const docNoMap: Record<string, string> = {};

    if (receiptIds.length > 0) {
      const receipts = await this.dataSource.query(
        `SELECT id, receipt_no FROM public.erp_goods_receipts WHERE id = ANY($1)`,
        [receiptIds],
      );
      receipts.forEach((r) => (docNoMap[r.id] = r.receipt_no));
    }

    if (issueIds.length > 0) {
      const issues = await this.dataSource.query(
        `SELECT id, issue_no FROM public.erp_goods_issues WHERE id = ANY($1)`,
        [issueIds],
      );
      issues.forEach((i) => (docNoMap[i.id] = i.issue_no));
    }

    if (adjustmentIds.length > 0) {
      const adjustments = await this.dataSource.query(
        `SELECT id, adjustment_no FROM public.erp_inventory_adjustments WHERE id = ANY($1)`,
        [adjustmentIds],
      );
      adjustments.forEach((a) => (docNoMap[a.id] = a.adjustment_no));
    }

    if (productionOrderIds.length > 0) {
      const pos = await this.dataSource.query(
        `SELECT id, po_no FROM public.erp_production_orders WHERE id = ANY($1)`,
        [productionOrderIds],
      );
      pos.forEach((p) => (docNoMap[p.id] = p.po_no));
    }

    let running = 0;
    const movements = txns.map((txn) => {
      const qtyIn = Number(txn.qtyIn ?? 0);
      const qtyOut = Number(txn.qtyOut ?? 0);
      running = running + qtyIn - qtyOut;
      return {
        id: txn.id,
        transactionDate: txn.transactionDate,
        transactionType: txn.transactionType,
        documentType: txn.documentType,
        documentId: txn.documentId,
        documentNo: txn.documentId ? docNoMap[txn.documentId] : null,
        qtyIn,
        qtyOut,
        unitCost: txn.unitCost ? Number(txn.unitCost) : null,
        balanceAfter: Math.round(running * 1000) / 1000,
        notes: txn.notes,
        createdAt: txn.createdAt,
      };
    });

    movements.reverse();

    return {
      message: 'Lịch sử xuất nhập kho',
      data: {
        item: {
          id: item.id,
          sku: item.sku,
          itemName: item.itemName,
          uom: item.uom,
          itemType: item.itemType,
        },
        currentOnHand,
        movements,
      },
    };
  }
}
