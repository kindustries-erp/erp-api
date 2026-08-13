import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GraphLayoutService } from '../../common/services/graph-layout.service';
import { CreateInventoryItemDto } from '../dto/create-item.dto';
import { UpdateInventoryItemDto } from '../dto/update-item.dto';
import { ErpInventoryBalance } from '../entities/erp_inventory_balance.entity';
import { ErpInventoryItem } from '../entities/erp_inventory_item.entity';
import { ErpInventoryTransaction } from '../entities/erp_inventory_transaction.entity';

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
    private readonly graphLayoutService: GraphLayoutService,
  ) {}

  async create(dto: CreateInventoryItemDto) {
    const entity = this.repository.create({
      ...dto,
      uomId: dto.uomId,
      itemTypeId: dto.itemTypeId,
      status: dto.status || 'ACTIVE',
      note: dto.note || undefined,
      trackingPolicyId: dto.trackingPolicyId || null,
      trackingCategoryId: dto.trackingCategoryId || null,
      attributes: dto.attributes || [],
    } as Partial<ErpInventoryItem>);
    const data = await this.repository.save(entity);
    return { message: 'Tạo thành công', data };
  }

  async findOne(id: string) {
    const data = await this.repository.findOne({
      where: { id },
      relations: ['uom', 'itemType'],
    });
    if (!data) throw new NotFoundException('Không tìm thấy item');
    return { message: 'Lấy thông tin thành công', data };
  }

  async update(id: string, dto: UpdateInventoryItemDto) {
    const item = await this.repository.findOneBy({ id });
    if (!item) throw new NotFoundException('Không tìm thấy item');

    if (dto.uomId !== undefined) item.uomId = dto.uomId;
    if (dto.itemTypeId !== undefined) item.itemTypeId = dto.itemTypeId;
    if (dto.itemName !== undefined) item.itemName = dto.itemName;
    if (dto.sku !== undefined) item.sku = dto.sku;
    if (dto.note !== undefined) item.note = dto.note;
    if (dto.status !== undefined) item.status = dto.status;
    if (dto.trackingPolicyId !== undefined)
      item.trackingPolicyId = dto.trackingPolicyId;
    if (dto.trackingCategoryId !== undefined)
      item.trackingCategoryId = dto.trackingCategoryId;
    if (dto.attributes !== undefined) item.attributes = dto.attributes;

    await this.repository.save(item);
    const data = await this.repository.findOne({
      where: { id },
      relations: ['uom', 'itemType', 'trackingPolicy', 'trackingCategory'],
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

  async getItemConnections(id: string) {
    const item = await this.repository.findOneByOrFail({ id });

    // Goods Receipts (limit 10)
    const grs = await this.dataSource.query(
      `
      SELECT g.id, g.receipt_no as "receiptNo", g.receipt_date as "receiptDate", g.status, SUM(l.qty_received) as qty,
             g.production_order_id as "productionOrderId", g.purchase_order_id as "purchaseOrderId"
      FROM public.erp_goods_receipts g
      JOIN public.erp_goods_receipt_lines l ON g.id = l.goods_receipt_id
      WHERE l.item_id = $1 AND g.is_deleted = false
      GROUP BY g.id, g.receipt_no, g.receipt_date, g.status, g.production_order_id, g.purchase_order_id
      ORDER BY g.receipt_date DESC, g.id DESC
      LIMIT 10
    `,
      [id],
    );

    // Goods Issues (limit 10)
    const gis = await this.dataSource.query(
      `
      SELECT g.id, g.issue_no as "issueNo", g.issue_date as "issueDate", g.status, SUM(l.qty_issued) as qty,
             g.production_order_id as "productionOrderId", g.sales_order_id as "salesOrderId"
      FROM public.erp_goods_issues g
      JOIN public.erp_goods_issue_lines l ON g.id = l.goods_issue_id
      WHERE l.item_id = $1 AND g.is_deleted = false
      GROUP BY g.id, g.issue_no, g.issue_date, g.status, g.production_order_id, g.sales_order_id
      ORDER BY g.issue_date DESC, g.id DESC
      LIMIT 10
    `,
      [id],
    );

    // Production Orders (limit 10)
    const pos = await this.dataSource.query(
      `
      SELECT p.id, p.reference_no as "orderNo", p.planned_start_date as "orderDate", p.status, 'FG' as role, p.qty_to_produce as qty, p.output_metadata->>'bomId' as "bomId"
      FROM public.erp_production_orders p
      WHERE p.finished_good_item_id = $1 AND p.is_deleted = false
      UNION
      SELECT p.id, p.reference_no as "orderNo", p.planned_start_date as "orderDate", p.status, 'COMPONENT' as role, SUM(m.qty_required) as qty, p.output_metadata->>'bomId' as "bomId"
      FROM public.erp_production_orders p
      JOIN public.erp_production_order_materials m ON p.id = m.production_order_id
      WHERE m.item_id = $1 AND p.is_deleted = false
      GROUP BY p.id, p.reference_no, p.planned_start_date, p.status, p.output_metadata
      LIMIT 10
    `,
      [id],
    );

    // BOMs (limit 10)
    const boms = await this.dataSource.query(
      `
      SELECT b.id, b.bom_code as "bomCode", b.bom_name as "bomName", b.status, 'FG' as role
      FROM public.erp_boms b
      WHERE b.finished_good_item_id = $1 AND b.is_deleted = false
      UNION
      SELECT DISTINCT b.id, b.bom_code as "bomCode", b.bom_name as "bomName", b.status, 'COMPONENT' as role
      FROM public.erp_boms b
      JOIN public.erp_bom_lines l ON b.id = l.bom_id
      WHERE l.component_item_id = $1 AND b.is_deleted = false
      LIMIT 10
    `,
      [id],
    );

    // Build Graph Nodes and Edges
    const nodes: any[] = [];
    const edges: any[] = [];

    // 1. Map lookups
    const grByPo = new Map<string, any[]>();
    grs.forEach((gr: any) => {
      if (gr.productionOrderId) {
        if (!grByPo.has(gr.productionOrderId))
          grByPo.set(gr.productionOrderId, []);
        grByPo.get(gr.productionOrderId)!.push(gr);
      }
    });

    const giByPo = new Map<string, any[]>();
    gis.forEach((gi: any) => {
      if (gi.productionOrderId) {
        if (!giByPo.has(gi.productionOrderId))
          giByPo.set(gi.productionOrderId, []);
        giByPo.get(gi.productionOrderId)!.push(gi);
      }
    });

    const poByBom = new Map<string, any[]>();
    pos.forEach((po: any) => {
      if (po.bomId) {
        if (!poByBom.has(po.bomId)) poByBom.set(po.bomId, []);
        poByBom.get(po.bomId)!.push(po);
      }
    });

    // 2. The Root Item Node
    nodes.push({
      id: `item-${item.id}`,
      // No module so it sits at root
      data: {
        nodeType: 'inventory_item',
        label: item.itemName,
        sublabel: item.sku,
        docId: item.id,
      },
    });

    // 3. Goods Receipts
    grs.forEach((gr: any) => {
      nodes.push({
        id: `gr-${gr.id}`,
        module: 'inventory',
        date: gr.receiptDate
          ? new Date(gr.receiptDate).toISOString()
          : undefined,
        data: {
          nodeType: 'goods_receipt',
          label: gr.receiptNo,
          status: gr.status,
          amount: Number(gr.qty || 0),
          docId: gr.id,
        },
      });
      // Removed edge to central item
    });

    // 4. Goods Issues
    gis.forEach((gi: any) => {
      nodes.push({
        id: `gi-${gi.id}`,
        module: 'inventory',
        date: gi.issueDate ? new Date(gi.issueDate).toISOString() : undefined,
        data: {
          nodeType: 'goods_issue',
          label: gi.issueNo,
          status: gi.status,
          amount: Number(gi.qty || 0),
          docId: gi.id,
        },
      });
      // Removed edge from central item
    });

    // 5. Production Orders
    pos.forEach((po: any) => {
      nodes.push({
        id: `po-${po.id}`,
        module: 'production',
        date: po.orderDate ? new Date(po.orderDate).toISOString() : undefined,
        data: {
          nodeType: 'production_order',
          label: po.orderNo,
          status: po.status,
          amount: Number(po.qty || 0),
          docId: po.id,
        },
      });

      if (po.role === 'FG') {
        const relatedGrs = grByPo.get(po.id);
        if (relatedGrs && relatedGrs.length > 0) {
          relatedGrs.forEach((gr) => {
            edges.push({
              id: `e-po-${po.id}-gr-${gr.id}`,
              source: `po-${po.id}`,
              target: `gr-${gr.id}`,
            });
          });
        }
      } else {
        const relatedGis = giByPo.get(po.id);
        if (relatedGis && relatedGis.length > 0) {
          relatedGis.forEach((gi) => {
            edges.push({
              id: `e-gi-${gi.id}-po-${po.id}`,
              source: `gi-${gi.id}`,
              target: `po-${po.id}`,
            });
          });
        }
      }
    });

    // 6. BOMs
    boms.forEach((bom: any) => {
      nodes.push({
        id: `bom-${bom.id}`,
        module: 'bom',
        data: {
          nodeType: 'bom',
          label: bom.bomCode,
          sublabel: bom.bomName,
          status: bom.status,
          docId: bom.id,
        },
      });

      const relatedPos = poByBom.get(bom.id);
      if (relatedPos && relatedPos.length > 0) {
        relatedPos.forEach((po) => {
          edges.push({
            id: `e-bom-${bom.id}-po-${po.id}`,
            source: `bom-${bom.id}`,
            target: `po-${po.id}`,
          });
        });
      }
    });

    // 7. Connect Root Item to Groups
    const populatedModules = new Set(
      nodes.filter((n) => n.module).map((n) => n.module),
    );
    populatedModules.forEach((mod) => {
      edges.push({
        id: `e-item-to-group-${mod}`,
        source: `item-${item.id}`,
        target: `group-${mod}`,
      });
    });

    const graph = await this.graphLayoutService.calculateSwimlaneLayout(
      nodes,
      edges,
    );

    return {
      message: 'Liên kết kho',
      data: {
        item: {
          id: item.id,
          sku: item.sku,
          itemName: item.itemName,
          uom: item.uom,
          itemType: item.itemType,
        },
        goodsReceipts: grs,
        goodsIssues: gis,
        productionOrders: pos,
        boms: boms,
        graph,
      },
    };
  }
}
