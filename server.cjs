const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const publicFiles = new Set(['index.html', 'Script.js', 'pdf-engine.js', 'style.css']);
for (const directory of ['tools', 'chatbot']) {
  for (const filename of fs.readdirSync(path.join(root, directory))) {
    if (filename.endsWith('.html')) publicFiles.add(`${directory}/${filename}`);
  }
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

http.createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  let filename;
  try {
    filename = decodeURIComponent(new URL(request.url, 'http://server').pathname).slice(1);
    if (!filename || filename.endsWith('/')) filename += 'index.html';
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }

  // Serve only the imported site's public files, never workspace files or secrets.
  if (!publicFiles.has(filename)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  fs.readFile(path.join(root, filename), (error, content) => {
    if (error) {
      console.error(`Unable to read public file: ${filename}`);
      response.writeHead(500);
      response.end('Unable to load file');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filename)] });
    response.end(request.method === 'HEAD' ? undefined : content);
  });
}).listen(5000, '0.0.0.0', () => {
  console.log('PDF EDIT TOOL is running on port 5000');
});
