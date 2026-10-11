const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { app } = require('../server.cjs');

let server;
let baseUrl;
let sourcePdf;

before(async () => {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  document.addPage([300, 300]).drawText('Original title', { x: 40, y: 240, size: 18, font });
  document.addPage([400, 400]).drawText('Page two', { x: 40, y: 330, size: 18, font });
  sourcePdf = Buffer.from(await document.save());

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

function editRequest(edits, { bytes = sourcePdf, contentType = 'application/pdf' } = {}) {
  const form = new FormData();
  form.append('pdf', new Blob([bytes], { type: contentType }), 'sample.pdf');
  form.append('edits', JSON.stringify(edits));
  return fetch(`${baseUrl}/api/pdf/edit`, { method: 'POST', body: form });
}

test('home page is served through Express', async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /PDF EDIT TOOL/);
});

test('server returns a valid multi-page PDF after replacing, deleting, and adding text', async () => {
  const edits = [
    { page: 1, operation: 'replace', x: 38, y: 238, width: 120, height: 24, fontSize: 14, text: 'Revised title' },
    { page: 2, operation: 'delete', x: 38, y: 328, width: 90, height: 25, fontSize: 14, text: '' },
    { page: 2, operation: 'add', x: 45, y: 280, width: 160, height: 30, fontSize: 16, text: 'Added on page two' },
  ];
  const response = await editRequest(edits);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/pdf/);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.match(response.headers.get('content-disposition'), /attachment/);

  const result = Buffer.from(await response.arrayBuffer());
  const parsed = await PDFDocument.load(result);
  assert.equal(parsed.getPageCount(), 2);
  assert.ok(result.length > sourcePdf.length);
});

test('invalid PDFs, out-of-page edits, and invalid input types are rejected', async () => {
  const invalidPdf = await editRequest([], { bytes: Buffer.from('not a PDF') });
  assert.equal(invalidPdf.status, 415);

  const invalidMime = await editRequest([], { contentType: 'text/plain' });
  assert.equal(invalidMime.status, 415);

  const invalidBounds = await editRequest([
    { page: 1, operation: 'add', x: 290, y: 290, width: 40, height: 30, fontSize: 14, text: 'Out of bounds' },
  ]);
  assert.equal(invalidBounds.status, 400);
});

test('only explicitly allowed website files are publicly served', async () => {
  const privateFile = await fetch(`${baseUrl}/package.json`);
  assert.equal(privateFile.status, 404);
  const apiFile = await fetch(`${baseUrl}/api/not-an-endpoint`);
  assert.equal(apiFile.status, 404);
});
