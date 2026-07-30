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
  const loginRes = await fetch('https://vinvoice.viettel.vn/api/auth/login', {
    method: 'POST',
    headers: { 'accept': 'application/json, text/plain, */*', 'content-type': 'application/json' },
    body: JSON.stringify({ username: '0318334886-003', password: 'Viettel@123', rememberMe: true }),
  });
  const loginData: any = await loginRes.json();
  const token = loginData.access_token;
  const cluster = loginData.invoice_cluster || 'cluster3';

  console.log('cluster', cluster);
  
  const fromStr = '2026-07-01T00:00:00.000Z';
  const toStr = '2026-07-29T23:59:59.000Z';
  const listUrl = `https://vinvoice.viettel.vn/api/${cluster}/services/einvoiceapplication/api/invoice/search-draft-all?page=0&size=2&createdDate.greaterThanOrEqual=${encodeURIComponent(fromStr)}&createdDate.lessThanOrEqual=${encodeURIComponent(toStr)}&invoiceStatus.equals=0&invoiceTypeId.notEquals=52&sort=id%2Cdesc`;

  const draftRes = await fetch(listUrl, {
    method: 'GET',
    headers: { 'accept': 'application/json, text/plain, */*', 'authorization': `Bearer ${token}` },
  });
  
  const rawData: any = await draftRes.json();
  const drafts = rawData?.data?.content || [];
  
  console.log('draft id 0', drafts[0]?.id);
  
  const vId = '450858046';
  const detailUrl = `https://vinvoice.viettel.vn/api/${cluster}/services/einvoiceapplication/api/invoice/search-invoice-by-id/${vId}/draft`;
  console.log('detailUrl', detailUrl);
  
  const detailRes = await fetch(detailUrl, {
    method: 'GET',
    headers: { 'accept': 'application/json, text/plain, */*', 'authorization': `Bearer ${token}` },
  });
  
  const detailData = await detailRes.json();
  const listProductStr = detailData?.data?.invoice?.listProduct || detailData?.data?.listProduct || detailData?.listProduct;
  console.log('listProductStr', listProductStr);
  
  if (listProductStr) {
    try {
      const parsed = JSON.parse(listProductStr);
      if (parsed && Array.isArray(parsed.itemInfo)) {
        console.log('parsed itemInfo', parsed.itemInfo.map((i: any) => i.itemName));
      }
    } catch (e) {
      console.log('parse err', e);
    }
  }

  await AppDataSource.destroy();
}
run().catch(console.error);
