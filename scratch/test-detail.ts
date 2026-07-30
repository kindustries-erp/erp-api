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
  
  // Need username/password, I can just hardcode what user gave: 0318334886-003 / Viettel@123
  const loginRes = await fetch('https://vinvoice.viettel.vn/api/auth/login', {
    method: 'POST',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      username: '0318334886-003',
      password: 'Viettel@123',
      rememberMe: true,
      captcha: '',
    }),
  });

  const loginData: any = await loginRes.json();
  const token = loginData.access_token;
  const cluster = loginData.invoice_cluster || 'cluster3';

  console.log('Token acquired', token?.substring(0, 10));

  const detailUrl = `https://vinvoice.viettel.vn/api/${cluster}/services/einvoiceapplication/api/invoice/search-invoice-by-id/450878719/draft`;
  
  const detailRes = await fetch(detailUrl, {
    method: 'GET',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'authorization': `Bearer ${token}`,
    },
  });

  const detailData = await detailRes.json();
  const listProduct = detailData?.data?.invoice?.listProduct || detailData?.data?.listProduct || detailData?.listProduct;
  console.log(JSON.stringify(listProduct, null, 2));
  
  await AppDataSource.destroy();
}
run().catch(console.error);
