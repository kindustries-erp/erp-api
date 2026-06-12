const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  const res = await client.query('SELECT count(*) FROM public.erp_purchase_orders;');
  console.log('PO Count:', res.rows[0].count);
  const resLines = await client.query('SELECT count(*) FROM public.erp_purchase_order_lines;');
  console.log('PO Lines Count:', resLines.rows[0].count);
  client.end();
}).catch(console.error);
