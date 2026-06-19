const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  const res = await client.query("SELECT * FROM public.erp_purchase_orders WHERE po_no = 'PO-20260421' OR id = 'DHP-200'");
  console.log('Found POs:', res.rows.map(r => ({id: r.id, po_no: r.po_no, status: r.status})));
  if (res.rows.length > 0) {
    const updateRes = await client.query("UPDATE public.erp_purchase_orders SET status = 'Draft' WHERE po_no = 'PO-20260421' OR id = 'DHP-200' RETURNING id, po_no, status");
    console.log('Updated POs:', updateRes.rows);
  } else {
    console.log('No PO found with that number.');
  }
  client.end();
}).catch(console.error);
