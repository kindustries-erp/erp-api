const { Client } = require('pg');
async function test() {
  const client = new Client({ connectionString: 'postgresql://neondb_owner:npg_ujKQn7hU8rBe@ep-old-term-ao0yd56e-pooler.c-2.ap-southeast-1.aws.neon.tech/erp-klotus-production?sslmode=require&channel_binding=require' });
  await client.connect();
  const res = await client.query('SELECT raw_data FROM gw_cases LIMIT 1;');
  console.log(JSON.stringify(res.rows[0].raw_data, null, 2));
  await client.end();
}
test();
