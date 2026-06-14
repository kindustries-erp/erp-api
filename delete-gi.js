const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  try {
    const ids = ['1b5edd4c-2e83-4430-a855-1befdf4dc903', 'b06c7a70-57e5-4430-83e0-58183dbbc8b0'];
    for (const id of ids) {
      await client.query("DELETE FROM public.erp_inventory_transactions WHERE document_id = $1", [id]);
      await client.query("DELETE FROM public.erp_goods_issue_lines WHERE goods_issue_id = $1", [id]);
      await client.query("DELETE FROM public.erp_goods_issues WHERE id = $1", [id]);
    }
    console.log('Deleted 2 GI items');
  } catch (err) {
    console.error(err);
  } finally {
    client.end();
  }
});
