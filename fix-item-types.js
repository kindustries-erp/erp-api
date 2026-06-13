const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(() => {
  return client.query("UPDATE public.erp_inventory_items SET item_type = 'RAW' WHERE item_type = 'Linh kiện'");
}).then(res => {
  console.log("Updated to RAW:", res.rowCount);
  return client.query("UPDATE public.erp_inventory_items SET item_type = 'GOODS' WHERE item_type = 'Thành phẩm'");
}).then(res => {
  console.log("Updated to GOODS:", res.rowCount);
  client.end();
}).catch(console.error);
