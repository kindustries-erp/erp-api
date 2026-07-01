const fetch = require('node-fetch');
require('dotenv').config({ path: '/opt/repos/liouni-erp-core/liouni-erp-api/.env' });

async function testLogin() {
  const host = process.env.GREENWAY_API_HOST;
  const username = process.env.GREENWAY_USERNAME;
  const password = process.env.GREENWAY_PASSWORD;
  const makhachhang = process.env.GREENWAY_MA_KHACH_HANG;

  console.log(`Host: ${host}, User: ${username}, KH: ${makhachhang}`);
  const response = await fetch(`https://${host}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      UserName: username,
      Password: password,
      MaKhachHang: makhachhang,
    }),
  });
  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Body:', text);
}
testLogin();
