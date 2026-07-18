const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/inventory/dashboard',
  method: 'GET',
  headers: {
    // We just need a generic request, but it's protected by JWT.
  }
});
req.end();
