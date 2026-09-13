import 'dotenv/config';
import dataSource from './db/data-source';
import { ErpBom } from './bom-core/entities/erp_bom.entity';
import { ErpBomLine } from './bom-core/entities/erp_bom_line.entity';
import { ErpInventoryItem } from './inventory-core/entities/erp_inventory_item.entity';
import { ErpBusinessPartner } from './business-partners-core/entities/erp_business_partner.entity';
import { ErpPurchaseOrder } from './purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from './purchase-orders-core/entities/erp_purchase_order_line.entity';
import { ErpGoodsReceipt } from './goods-receipts-core/entities/erp_goods_receipt.entity';
import { ErpGoodsReceiptLine } from './goods-receipts-core/entities/erp_goods_receipt_line.entity';
import { ErpItemType } from './inventory-core/entities/erp_item_type.entity';
import { ErpUom } from './inventory-core/entities/erp_uom.entity';
import { ErpTrackingPolicy } from './inventory-core/entities/erp_tracking_policy.entity';

const VEHICLE_SKU = 'TEST-CAR-01';
const BOM_CODE = 'BOM-TEST-CAR-01';
const NUM_VEHICLES = 5;

async function getOrCreateMasterData() {
  const uomRepo = dataSource.getRepository(ErpUom);
  const itemTypeRepo = dataSource.getRepository(ErpItemType);
  const trackingPolicyRepo = dataSource.getRepository(ErpTrackingPolicy);

  let pcsUom = await uomRepo.findOne({ where: { code: 'PCS' } });
  if (!pcsUom) {
    pcsUom = await uomRepo.save(
      uomRepo.create({ code: 'PCS', name: 'Piece', isActive: true } as ErpUom),
    );
    console.log('Created UOM PCS');
  }

  let fgType = await itemTypeRepo.findOne({ where: { code: 'FG' } });
  if (!fgType) {
    fgType = await itemTypeRepo.save(
      itemTypeRepo.create({
        code: 'FG',
        name: 'Finished Good',
        isActive: true,
      } as ErpItemType),
    );
    console.log('Created item type FG');
  }

  let rawType = await itemTypeRepo.findOne({ where: { code: 'RAW' } });
  if (!rawType) {
    rawType = await itemTypeRepo.save(
      itemTypeRepo.create({
        code: 'RAW',
        name: 'Raw Material',
        isActive: true,
      } as ErpItemType),
    );
    console.log('Created item type RAW');
  }

  let serialPolicy = await trackingPolicyRepo.findOne({
    where: { code: 'SERIAL' },
  });
  if (!serialPolicy) {
    serialPolicy = await trackingPolicyRepo.save(
      trackingPolicyRepo.create({
        code: 'SERIAL',
        name: 'Serial Number',
        isActive: true,
      } as ErpTrackingPolicy),
    );
    console.log('Created tracking policy SERIAL');
  }

  let vehiclePolicy = await trackingPolicyRepo.findOne({
    where: { code: 'VEHICLE' },
  });
  if (!vehiclePolicy) {
    vehiclePolicy = await trackingPolicyRepo.save(
      trackingPolicyRepo.create({
        code: 'VEHICLE',
        name: 'Vehicle',
        isActive: true,
      } as ErpTrackingPolicy),
    );
    console.log('Created tracking policy VEHICLE');
  }

  return { pcsUom, fgType, rawType, serialPolicy, vehiclePolicy };
}

async function getOrCreateSupplier() {
  const bpRepo = dataSource.getRepository(ErpBusinessPartner);
  let supplier = await bpRepo.findOne({
    where: { code: 'SUP-TEST-001' },
  });
  if (!supplier) {
    supplier = await bpRepo.save(
      bpRepo.create({
        code: 'SUP-TEST-001',
        name: 'Nhà cung cấp Test',
        displayName: 'NCC Test',
        partnerType: 'SUPPLIER',
        status: 'ACTIVE',
        isDeleted: false,
      }),
    );
    console.log('Created supplier SUP-TEST-001');
  }
  return supplier;
}

async function getOrCreateVehicleAndBom(master: {
  pcsUom: ErpUom;
  fgType: ErpItemType;
  rawType: ErpItemType;
  serialPolicy: ErpTrackingPolicy;
  vehiclePolicy: ErpTrackingPolicy;
}) {
  const itemRepo = dataSource.getRepository(ErpInventoryItem);
  const bomRepo = dataSource.getRepository(ErpBom);
  const bomLineRepo = dataSource.getRepository(ErpBomLine);

  let vehicle = await itemRepo.findOne({ where: { sku: VEHICLE_SKU } });
  if (!vehicle) {
    vehicle = await itemRepo.save(
      itemRepo.create({
        sku: VEHICLE_SKU,
        itemName: 'Xe Test As-Built BOM 01',
        itemTypeId: master.fgType.id,
        uomId: master.pcsUom.id,
        trackingPolicyId: master.vehiclePolicy.id,
        status: 'ACTIVE',
      }),
    );
    console.log(`Created vehicle item ${VEHICLE_SKU}`);
  }

  const components = [
    { sku: 'TEST-MOTOR-01', name: 'Động cơ điện Test', qty: 1 },
    { sku: 'TEST-BATT-01', name: 'Pin xe điện Test', qty: 1 },
  ];

  const componentItems: { item: ErpInventoryItem; qty: number }[] = [];
  for (const comp of components) {
    let item = await itemRepo.findOne({ where: { sku: comp.sku } });
    if (!item) {
      item = await itemRepo.save(
        itemRepo.create({
          sku: comp.sku,
          itemName: comp.name,
          itemTypeId: master.rawType.id,
          uomId: master.pcsUom.id,
          trackingPolicyId: master.serialPolicy.id,
          status: 'ACTIVE',
        }),
      );
      console.log(`Created component item ${comp.sku}`);
    }
    componentItems.push({ item, qty: comp.qty });
  }

  let bom = await bomRepo.findOne({
    where: { bomCode: BOM_CODE },
  });
  if (!bom) {
    bom = await bomRepo.save(
      bomRepo.create({
        bomCode: BOM_CODE,
        bomName: 'BOM Xe Test',
        finishedGoodItemId: vehicle.id,
        version: '1.0',
        status: 'ACTIVE',
      }),
    );

    for (let i = 0; i < componentItems.length; i++) {
      await bomLineRepo.save(
        bomLineRepo.create({
          bomId: bom.id,
          lineNo: i + 1,
          componentItemId: componentItems[i].item.id,
          qtyRequired: String(componentItems[i].qty),
          uomId: master.pcsUom.id,
        }),
      );
    }
    console.log(`Created BOM ${BOM_CODE}`);
  }

  return { vehicle, componentItems };
}

async function createPurchaseOrder(
  supplier: ErpBusinessPartner,
  componentItems: { item: ErpInventoryItem; qty: number }[],
) {
  const poRepo = dataSource.getRepository(ErpPurchaseOrder);
  const poLineRepo = dataSource.getRepository(ErpPurchaseOrderLine);

  const orderDate = new Date().toISOString();
  const po = await poRepo.save(
    poRepo.create({
      poNo: `PO-TEST-${Date.now()}`,
      supplierId: supplier.id,
      orderDate,
      status: 'ACTIVE',
      paymentStatus: 'UNPAID',
    }),
  );

  for (let i = 0; i < componentItems.length; i++) {
    const { item, qty } = componentItems[i];
    const totalQty = qty * NUM_VEHICLES;
    await poLineRepo.save(
      poLineRepo.create({
        purchaseOrderId: po.id,
        lineNo: i + 1,
        itemId: item.id,
        itemCode: item.sku,
        itemName: item.itemName,
        qtyOrdered: String(totalQty),
        qtyReceived: '0',
        unitPrice: '1000000',
        amount: String(totalQty * 1000000),
      }),
    );
  }

  console.log(
    `Created PO ${po.poNo} with ${componentItems.length} lines for ${NUM_VEHICLES} vehicles`,
  );
  return po;
}

async function createGoodsReceipt(
  po: ErpPurchaseOrder,
  supplier: ErpBusinessPartner,
  componentItems: { item: ErpInventoryItem; qty: number }[],
) {
  const grRepo = dataSource.getRepository(ErpGoodsReceipt);
  const grLineRepo = dataSource.getRepository(ErpGoodsReceiptLine);
  const poLineRepo = dataSource.getRepository(ErpPurchaseOrderLine);

  const poLines = await poLineRepo.find({
    where: { purchaseOrderId: po.id },
    order: { lineNo: 'ASC' },
  });

  const receiptDate = new Date().toISOString();
  const gr = await grRepo.save(
    grRepo.create({
      receiptNo: `NK-TEST-${Date.now()}`,
      purchaseOrderId: po.id,
      supplierId: supplier.id,
      receiptDate,
      status: 'DRAFT',
    }),
  );

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
        unitCost: '1000000',
        amount: String(qty * 1000000),
        serialsGenerated: false,
      }),
    );
  }

  console.log(
    `Created Goods Receipt ${gr.receiptNo} with ${poLines.length} lines (status: DRAFT)`,
  );
  console.log(
    'Go to Goods Receipts page and POST it to trigger serial generation.',
  );
  return gr;
}

async function bootstrap() {
  await dataSource.initialize();
  console.log('--- Seed PO for 5 vehicles ---');

  const master = await getOrCreateMasterData();
  const supplier = await getOrCreateSupplier();
  const { componentItems } = await getOrCreateVehicleAndBom(master);
  const po = await createPurchaseOrder(supplier, componentItems);
  const gr = await createGoodsReceipt(po, supplier, componentItems);

  console.log('\nSummary:');
  console.log(`- Vehicle SKU: ${VEHICLE_SKU}`);
  console.log(`- BOM: ${BOM_CODE}`);
  console.log(`- PO: ${po.poNo}`);
  console.log(`- Goods Receipt: ${gr.receiptNo} (DRAFT)`);
  console.log(
    `- Quantities: ${NUM_VEHICLES} motors + ${NUM_VEHICLES} batteries`,
  );
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
