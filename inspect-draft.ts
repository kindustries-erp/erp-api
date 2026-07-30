import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await AppDataSource.initialize();
  const res = await AppDataSource.query("SELECT response_payload FROM sinvoice_drafts WHERE document_no LIKE 'VIETTEL-%' LIMIT 1");
  console.log(JSON.stringify(res[0]?.response_payload, null, 2));
  await AppDataSource.destroy();
}
run().catch(console.error);
