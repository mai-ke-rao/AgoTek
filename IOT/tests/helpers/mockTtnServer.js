const http = require('http');

// Stands in for TTN's downlink push endpoint (the URL stored on Device.downpush).
// This is the network boundary IOT/controllers/TTN.js's POST /send-downlink
// calls out to — mocking it here means tests never touch the real TTN network.
function startMockTtnServer() {
  const requests = [];
  let nextResponse = { status: 200, body: { ok: true } };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let body = raw;
      try {
        body = raw ? JSON.parse(raw) : undefined;
      } catch {
        // leave body as the raw string if it wasn't JSON
      }

      requests.push({ method: req.method, url: req.url, headers: req.headers, body });

      const { status, body: resBody } = nextResponse;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(resBody));
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        setNextResponse: (response) => { nextResponse = response; },
        close: () => new Promise((res) => server.close(res)),
      });
    });
  });
}

module.exports = { startMockTtnServer };
