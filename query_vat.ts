import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '/home/dev/repos/erp/erp-api/.env' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  const res = await client.query(`
    SELECT DISTINCT vat_rate FROM erp_invoice_items WHERE vat_rate IS NOT NULL
  `);
  console.log(res.rows);
  const res2 = await client.query(`
    SELECT DISTINCT vat_rate FROM erp_invoices WHERE vat_rate IS NOT NULL
  `);
  console.log(res2.rows);
  await client.end();
}

run();
