// Local Development Server for PayForge & Whop API
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const createCheckoutHandler = require('./api/create-checkout');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // API Route
  if (urlPath === '/api/create-checkout') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      req.body = body;
      await createCheckoutHandler(req, res);
    });
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\x1b[32m✔ Server running at http://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[36mℹ Whop checkout endpoint ready at http://localhost:${PORT}/api/create-checkout\x1b[0m`);
});
