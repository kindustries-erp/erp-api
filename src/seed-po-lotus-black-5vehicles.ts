import 'dotenv/config';
import dataSource from './db/data-source';
import { ErpBom } from './bom-core/entities/erp_bom.entity';
import { ErpPurchaseOrder } from './purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from './purchase-orders-core/entities/erp_purchase_order_line.entity';
import { ErpGoodsReceipt } from './goods-receipts-core/entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from './goods-receipts-core/entities/erp_goods_receipt_line.entity';
import { ErpBusinessPartner } from './business-partners-core/entities/erp_business_partner.entity';

const BOM_CODE = 'K LOTUS-SX-BM-01-04-DEN';
const NUM_VEHICLES = 5;

async function bootstrap() {
  await dataSource.initialize();
  console.log(
    `--- Seed PO for ${NUM_VEHICLES} vehicles from BOM ${BOM_CODE} ---`,
  );

  // 1. Find BOM
  const bomRepo = dataSource.getRepository(ErpBom);
  const bom = await bomRepo.findOne({ where: { bomCode: BOM_CODE } });
  if (!bom) {
    console.error(`BOM ${BOM_CODE} not found`);
    process.exit(1);
  }

  // 2. Get BOM lines with component details
  const lines = await dataSource.query(
    `SELECT bl.id, bl.line_no, bl.component_item_id, bl.qty_required,
            i.sku, i.item_name, i.tracking_policy_id, tp.code as tracking_policy_code
     FROM erp_bom_lines bl
     JOIN erp_inventory_items i ON i.id = bl.component_item_id
     LEFT JOIN erp_tracking_policies tp ON tp.id = i.tracking_policy_id
     WHERE bl.bom_id = $1
     ORDER BY bl.line_no`,
    [bom.id],
  );

  console.log(`Found ${lines.length} BOM lines`);
  const totalSerials = lines.reduce(
    (sum: number, l: any) => sum + Number(l.qty_required) * NUM_VEHICLES,
    0,
  );
  console.log(
    `Total serials to generate for ${NUM_VEHICLES} vehicles: ${totalSerials}`,
  );

  // 3. Find supplier
  const supplier = await dataSource
    .getRepository(ErpBusinessPartner)
    .findOne({ where: { partnerType: 'SUPPLIER', status: 'ACTIVE' } });
  if (!supplier) {
    console.error('No active supplier found');
    process.exit(1);
  }

  // 4. Create Purchase Order
  const poRepo = dataSource.getRepository(ErpPurchaseOrder);
  const poLineRepo = dataSource.getRepository(ErpPurchaseOrderLine);
  const orderDate = new Date().toISOString();

  const po = await poRepo.save(
    poRepo.create({
      poNo: `PO-LOTUS-DEN-${Date.now()}`,
      supplierId: supplier.id,
      orderDate,
      status: 'ACTIVE',
      paymentStatus: 'UNPAID',
    }),
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const qty = Number(line.qty_required) * NUM_VEHICLES;
    await poLineRepo.save(
      poLineRepo.create({
        purchaseOrderId: po.id,
        lineNo: i + 1,
        itemId: line.component_item_id,
        itemCode: line.sku,
        itemName: line.item_name,
        qtyOrdered: String(qty),
        qtyReceived: '0',
        unitPrice: '100000',
        amount: String(qty * 100000),
      }),
    );
  }

  console.log(`Created PO ${po.poNo} with ${lines.length} lines`);

  // 5. Create Goods Receipt (DRAFT)
  const grRepo = dataSource.getRepository(ErpGoodsReceipt);
  const grLineRepo = dataSource.getRepository(ErpGoodsReceiptLine);
  const receiptDate = new Date().toISOString();

  const gr = await grRepo.save(
    grRepo.create({
      receiptNo: `NK-LOTUS-DEN-${Date.now()}`,
      purchaseOrderId: po.id,
      supplierId: supplier.id,
      receiptDate,
      status: 'DRAFT',
    }),
  );

  const poLines = await poLineRepo.find({
    where: { purchaseOrderId: po.id },
    order: { lineNo: 'ASC' },
  });

  for (let i = 0; i < poLines.length; i++) {
    const poLine = poLines[i];
    const qty = Number(poLine.qtyOrdered);
    await grLineRepo.save(
      grLineRepo.create({
        goodsReceiptId: gr.id,
        lineNo: i + 1,
        purchaseOrderLineId: poLine.id,
        itemId: poLine.itemId,
        qtyReceived: String(qty),
        unitCost: '100000',
        amount: String(qty * 100000),
        serialsGenerated: false,
      }),
    );
  }

  console.log(
    `Created Goods Receipt ${gr.receiptNo} with ${poLines.length} lines (DRAFT)`,
  );
  console.log('\nSummary:');
  console.log(`- BOM: ${BOM_CODE}`);
  console.log(`- PO: ${po.poNo}`);
  console.log(`- Goods Receipt: ${gr.receiptNo}`);
  console.log(`- Total serials to generate: ${totalSerials}`);
  console.log(
    '\nNext step: Open Goods Receipts page, find the receipt, and click Post.',
  );

  await dataSource.destroy();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
