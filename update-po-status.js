const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  const res = await client.query("SELECT * FROM public.erp_purchase_orders WHERE code = 'PO-20260421' OR id = 'DHP-200'");
  console.log('Found POs:', res.rows);
  if (res.rows.length > 0) {
    const updateRes = await client.query("UPDATE public.erp_purchase_orders SET status = 'draft' WHERE code = 'PO-20260421' OR id = 'DHP-200' RETURNING *");
    console.log('Updated POs:', updateRes.rows);
  }
  client.end();
}).catch(console.error);
