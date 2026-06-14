const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DB_URL });
client.connect().then(() => {
  return client.query(`
    BEGIN;
    DELETE FROM public.erp_po_receipt_lines;
    DELETE FROM public.erp_po_receipts;
    DELETE FROM public.erp_purchase_order_materials;
    DELETE FROM public.erp_purchase_orders;
    DELETE FROM public.erp_inventory_transactions;
    DELETE FROM public.erp_inventory_balances;
    COMMIT;
  `);
}).then(() => {
  console.log("Successfully deleted purchase orders and inventory.");
  client.end();
}).catch(err => {
  console.error("Error:", err);
  client.end();
});
