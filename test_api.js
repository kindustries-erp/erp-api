const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/erp' });
async function run() {
  await client.connect();
  const res = await client.query(`
      SELECT 
        i.id as item_id, i.sku, i.item_name as item_name, 
        t.id as type_id, t.name as type_name,
        COALESCE(b.qty_on_hand, 0) as qty,
        COALESCE(b.avg_unit_cost, 0) as cost,
        (
          SELECT MAX(transaction_date) 
          FROM erp_inventory_transactions txn 
          WHERE txn.item_id = i.id AND txn.transaction_type = 'OUT'
        ) as last_issue_date
      FROM erp_inventory_items i
      LEFT JOIN erp_inventory_balances b ON i.id = b.item_id
      LEFT JOIN erp_item_types t ON i.item_type_id = t.id
      WHERE i.is_deleted = false
      LIMIT 1;
  `);
  console.log(res.rows[0]);
  await client.end();
}
run();
