const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_tbuixnxomfnpitl07pkpvSecure%21@ep-polished-surf-aodypyoo-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(async () => {
  const sql = fs.readFileSync('seed-pos.sql', 'utf8');
  await client.query('BEGIN;');
  await client.query(sql);
  await client.query('COMMIT;');
  console.log('Seed SQL executed successfully');
  client.end();
}).catch(async err => {
  console.error(err);
  await client.query('ROLLBACK;');
  client.end();
});
