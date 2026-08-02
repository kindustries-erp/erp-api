import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await AppDataSource.initialize();
  const res = await AppDataSource.query(`SELECT id, document_no, description, response_payload FROM sinvoice_drafts LIMIT 5;`);
  console.log(res.map(r => ({ id: r.id, desc: r.description, lp: r.response_payload?.listProduct })));
  await AppDataSource.destroy();
}
run().catch(console.error);
