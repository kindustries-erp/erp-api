const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/erp' });
async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'erp_inventory_serials' OR table_name = 'erp_inventory_transactions';
  `);
  console.log(res.rows);
  await client.end();
}
run();
