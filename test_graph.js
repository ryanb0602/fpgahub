const http = require('http');
http.get('http://localhost:5000/api/graph', {
  headers: { 'Cookie': 'connect.sid=fake_session_id' }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(data);
  });
});
