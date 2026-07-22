const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/erp'
});
async function run() {
  await client.connect();
  const res = await client.query("SELECT * FROM erp_boms WHERE bom_name ILIKE '%xe đen%' OR bom_name ILIKE '%den%' OR bom_name ILIKE '%black%' OR bom_code ILIKE '%den%' OR bom_code ILIKE '%black%'");
  console.log(res.rows);
  await client.end();
}
run();
