const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  const res = await client.query("SELECT * FROM public.erp_purchase_orders LIMIT 1");
  console.log('Columns:', Object.keys(res.rows[0] || {}));
  client.end();
}).catch(console.error);
