const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/erp-invoices/stats?direction=OUT',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('monthChart:', parsed.monthChart);
    } catch(e) {
      console.log('Error parsing JSON. Raw output:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});
req.end();
