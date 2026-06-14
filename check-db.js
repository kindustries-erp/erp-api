const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(() => {
  console.log("Connected");
  return client.query("SELECT count(*) FROM public.erp_business_partners WHERE partner_type = 'VENDOR'");
}).then(res => {
  console.log("Count:", res.rows[0].count);
  client.end();
}).catch(console.error);
