const axios = require('axios');
axios.get('http://localhost:10003/api/v1/sinvoice/draft/column-options?column=vatAmount&page=1', {
  headers: {
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNjIxMDI1My04N2YxLTRhNTUtYjlmZC04OGMxYThjMjlkMmUiLCJlbWFpbCI6ImFkbWluQGxpb3VuaS5jb20iLCJzdGF0dXMiOiJBQ1RJVkUiLCJpYXQiOjE3ODU1NjMzMjYsImV4cCI6MTc4NTU5MjEyNn0.OhSu6ejPPWr67SeJEWgU0nih6He86PUQJE5tL3Jhoyc'
  }
}).then(console.log).catch(console.error);
