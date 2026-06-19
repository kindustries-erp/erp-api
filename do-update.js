const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });

async function run() {
  await client.connect();
  console.log('Connected');
  try {
    await client.query("UPDATE public.erp_purchase_orders SET status = 'CONFIRMED' WHERE id = '0ca1280c-d46a-506e-9b30-0cb4da428125'");
    await client.query("UPDATE public.erp_purchase_orders SET status = 'DRAFT' WHERE id = 'df935194-f757-59cb-9b7a-7887f19122f7'");
    console.log('Fixed POs');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
    console.log('Disconnected');
  }
}

run();
