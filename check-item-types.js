const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(() => {
  return client.query("SELECT distinct item_type FROM public.erp_inventory_items");
}).then(res => {
  console.log(res.rows);
  client.end();
}).catch(console.error);
