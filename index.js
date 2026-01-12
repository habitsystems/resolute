/*
 * Prioritise Everything
 * Copyright (c) 2026 Habit Labs
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
// Simple static server to host the prioritisation tool
// No external dependencies required

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // Normalize URL and prevent path traversal
  const safeUrl = decodeURI(req.url.split('?')[0]).replace(/\\/g, '/');
  let relPath = safeUrl;
  if (relPath === '/' || relPath === '') {
    relPath = '/index.html';
  }

  const requestedPath = path.normalize(path.join(PUBLIC_DIR, relPath));

  // Ensure the requested path stays within PUBLIC_DIR
  if (!requestedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(requestedPath, (err, stats) => {
    if (err) {
      // Fallback to index.html for SPA routes
      return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
    }
    if (stats.isDirectory()) {
      return sendFile(res, path.join(requestedPath, 'index.html'));
    }
    return sendFile(res, requestedPath);
  });
});

server.listen(PORT, () => {
  console.log(`Prioritisation tool running at http://localhost:${PORT}`);
});
