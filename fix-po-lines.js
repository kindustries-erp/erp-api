const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  await client.query(`
    UPDATE public.erp_purchase_order_lines pol
    SET item_id = ii.id
    FROM public.erp_inventory_items ii
    WHERE pol.description = ii.item_name;
  `);
  const res = await client.query('SELECT count(*) FROM public.erp_purchase_order_lines WHERE item_id IS NOT NULL;');
  console.log('PO Lines with valid item_id:', res.rows[0].count);
  client.end();
}).catch(console.error);
