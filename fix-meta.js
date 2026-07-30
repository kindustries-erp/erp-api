const { Client } = require('pg');
require('dotenv').config();
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  await client.query('DROP TABLE IF EXISTS typeorm_metadata');
  await client.query(`
    CREATE TABLE typeorm_metadata (
      "type" varchar(255) NOT NULL,
      "database" varchar(255) DEFAULT NULL,
      "schema" varchar(255) DEFAULT NULL,
      "table" varchar(255) DEFAULT NULL,
      "name" varchar(255) DEFAULT NULL,
      "value" text
    )
  `);
  console.log('Fixed metadata table');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
