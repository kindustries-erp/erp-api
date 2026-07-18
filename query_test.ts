import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
});

async function run() {
  await ds.initialize();
  const res = await ds.query(`SELECT SUM(qty_produced) as total FROM erp_production_orders;`);
  console.log('Total produced:', res);
  const countSerials = await ds.query(`SELECT COUNT(*) FROM erp_inventory_tracking_serials WHERE production_order_id IS NOT NULL;`);
  console.log('Serials with PO:', countSerials);
  const countAllSerials = await ds.query(`SELECT COUNT(*) FROM erp_inventory_tracking_serials;`);
  console.log('All Serials:', countAllSerials);
  
  // check if serials are linked via goods receipt lines
  const countSerialsViaGR = await ds.query(`
    SELECT COUNT(*) FROM erp_inventory_tracking_serials s
    JOIN erp_goods_receipt_lines grl ON s.receipt_line_id = grl.id
    JOIN erp_goods_receipts gr ON grl.goods_receipt_id = gr.id
    WHERE gr.production_order_id IS NOT NULL;
  `);
  console.log('Serials via GR:', countSerialsViaGR);
  
  await ds.destroy();
}
run();
