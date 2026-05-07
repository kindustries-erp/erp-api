const qs = require('qs');

async function test() {
  const directusUrl = 'https://db-production.liouni.com';
  const token = 'FRwU9pY5S00gJeHcfEhc99UsdaghXZko'; // ADMIN TOKEN

  const queryParams = { 
    limit: 1, 
    meta: 'filter_count',
    fields: '*,user.first_name,user.last_name,user.email'
  };
  const queryString = qs.stringify(queryParams, { arrayFormat: 'brackets', encode: false });
  
  const urlActivity = `${directusUrl}/activity?${queryString}`;

  try {
    console.log('Fetching:', urlActivity);
    const res = await fetch(urlActivity, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    console.log('\n--- KẾT QUẢ TỪ BACKEND ---');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
