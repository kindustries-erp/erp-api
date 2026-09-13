import { Client } from 'pg';

async function run() {
  const client = new Client({
    connectionString:
      'postgresql://neondb_owner:npg_oaS2mVUCGM6P@ep-gentle-forest-a7qe1w16-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  });
  await client.connect();

  const d02 = await client.query(
    `SELECT sku, item_name, id FROM erp_inventory_items WHERE sku = 'D02' OR sku LIKE '%PACEO%' OR sku = 'D02 (K LOTUS/ PACEO)' LIMIT 10`,
  );
  console.log('D02 items exact:', d02.rows);

  await client.end();
}
run().catch(console.error);
