import 'dotenv/config';
import dataSource from '../../db/data-source';
import { ErpInventoryItem } from '../../inventory-core/entities/erp_inventory_item.entity';
import { ErpBusinessPartner } from '../../business-partners-core/entities/erp_business_partner.entity';
import { ErpPurchaseOrder } from '../../purchase-orders-core/entities/erp_purchase_order.entity';
import { ErpPurchaseOrderLine } from '../../purchase-orders-core/entities/erp_purchase_order_line.entity';
import { ErpSalesOrder } from '../../sales-orders-core/entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from '../../sales-orders-core/entities/erp_sales_order_line.entity';

async function seedOrders() {
  await dataSource.initialize();
  console.log('Database connected.');

  // Get some parts
  const itemRepo = dataSource.getRepository(ErpInventoryItem);
  const items = await itemRepo.find({
    where: { status: 'ACTIVE' },
    take: 5,
  });

  if (items.length === 0) {
    console.error('No active inventory items found.');
    process.exit(1);
  }

  // Get some business partners
  const bpRepo = dataSource.getRepository(ErpBusinessPartner);
  let supplier = await bpRepo.findOne({ where: { partnerType: 'SUPPLIER' } });
  let customer = await bpRepo.findOne({ where: { partnerType: 'CUSTOMER' } });

  if (!supplier) supplier = await bpRepo.findOne({});
  if (!customer) customer = await bpRepo.findOne({});

  if (!supplier || !customer) {
    console.error('No business partners found.');
    process.exit(1);
  }

  // Create Purchase Order
  const poRepo = dataSource.getRepository(ErpPurchaseOrder);
  const poLineRepo = dataSource.getRepository(ErpPurchaseOrderLine);

  const po = poRepo.create({
    poNo: `PO-TEST-${Date.now()}`,
    supplierId: supplier.id,
    orderDate: new Date().toISOString().split('T')[0],
    status: 'ACTIVE',
    remarks: 'Test PO for Vouchers',
  });
  await poRepo.save(po);

  for (let i = 0; i < 2 && i < items.length; i++) {
    const line = poLineRepo.create({
      purchaseOrderId: po.id,
      lineNo: i + 1,
      itemId: items[i].id,
      itemCode: items[i].sku,
      itemName: items[i].itemName,
      qtyOrdered: '10',
      unitPrice: '50000',
      amount: '500000',
    });
    await poLineRepo.save(line);
  }
  console.log(`Created PO: ${po.poNo}`);

  // Create Sales Order
  const soRepo = dataSource.getRepository(ErpSalesOrder);
  const soLineRepo = dataSource.getRepository(ErpSalesOrderLine);

  const so = soRepo.create({
    soNo: `SO-TEST-${Date.now()}`,
    customerId: customer.id,
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split('T')[0],
    status: 'ACTIVE',
    remarks: 'Test SO for Vouchers',
  });
  await soRepo.save(so);

  for (let i = 0; i < 2 && i < items.length; i++) {
    const line = soLineRepo.create({
      salesOrderId: so.id,
      lineNo: i + 1,
      itemId: items[i].id,
      itemName: items[i].itemName,
      qtyOrdered: '5',
      unitPrice: '120000',
      amount: '600000',
    });
    await soLineRepo.save(line);
  }
  console.log(`Created SO: ${so.soNo}`);

  await dataSource.destroy();
  console.log('Done.');
}

seedOrders().catch((err) => {
  console.error('Error seeding:', err);
  process.exit(1);
});
