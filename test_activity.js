const qs = require('qs');

async function test() {
  const directusUrl = 'https://db-production.liouni.com';
  const token = 'FRwU9pY5S00gJeHcfEhc99UsdaghXZko';

  const queryParams = { limit: 1 };
  const queryString = qs.stringify(queryParams, { arrayFormat: 'brackets', encode: false });
  const url = `${directusUrl}/items/directus_activity?${queryString}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('Status:', response.status);
    console.log('StatusText:', response.statusText);
    const text = await response.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
