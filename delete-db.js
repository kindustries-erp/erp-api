const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });

async function clearData() {
  await client.connect();
  
  const tables = [
    'erp_inventory_transactions',
    'erp_inventory_balances',
    'erp_purchase_order_materials',
    'erp_purchase_order_lines',
    'erp_purchase_orders',
    'erp_goods_receipt_lines',
    'erp_goods_receipts',
    'erp_operational_lines',
    'erp_operational_documents'
  ];

  for (const table of tables) {
    try {
      const res = await client.query(`DELETE FROM public.${table};`);
      console.log(`Deleted ${res.rowCount} rows from ${table}`);
    } catch (e) {
      console.log(`Table ${table} error:`, e.message);
    }
  }
  
  await client.end();
}

clearData().catch(console.error);
