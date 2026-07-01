const fetch = require('node-fetch');
require('dotenv').config({ path: '/opt/repos/liouni-erp-core/liouni-erp-api/.env' });

async function testDetail() {
  const host = process.env.GREENWAY_API_HOST;
  const username = "apidongbo";
  const password = "D19101CC07C7";
  const makhachhang = process.env.GREENWAY_MA_KHACH_HANG;

  const loginRes = await fetch(`https://${host}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ UserName: username, Password: password, MaKhachHang: makhachhang }),
  });
  
  if (!loginRes.ok) {
    console.log('Login failed', loginRes.status);
    return;
  }
  
  const tokenData = await loginRes.json();
  const token = tokenData.AccessToken;
  
  const branchId = "0b4d6d3a-55df-492b-abaf-377d84b61d05";
  const caseId = "1827317420";
  console.log(`Fetching case detail for ${caseId}...`);
  
  const detailRes = await fetch(`https://${host}/api/v1/gr/cases/case?id=${caseId}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'SS_ClientID': branchId
    }
  });
  
  console.log('Detail Status:', detailRes.status);
  const text = await detailRes.text();
  console.log('Detail Body:', text);
}

testDetail();
