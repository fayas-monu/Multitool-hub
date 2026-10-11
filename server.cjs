const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const app = express();
const root = __dirname;
const maxUploadBytes = 25 * 1024 * 1024;
const maxPages = 500;
const maxEdits = 2000;
const maxTextLength = 5000;

app.disable('x-powered-by');
app.set('trust proxy', 1);

const publicFiles = new Set(['index.html', 'Script.js', 'pdf-engine.js', 'style.css']);
for (const directory of ['tools', 'chatbot']) {
  for (const filename of require('node:fs').readdirSync(path.join(root, directory))) {
    if (filename.endsWith('.html')) publicFiles.add(`${directory}/${filename}`);
  }
}

app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
  });
  next();
});

const rateWindows = new Map();
const rateLimit = (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const window = rateWindows.get(key);

  if (!window || now - window.startedAt >= 60_000) {
    rateWindows.set(key, { startedAt: now, count: 1 });
  } else if (window.count >= 20) {
    res.set('Retry-After', '60').status(429).json({ error: 'Too many PDF edits. Try again in a minute.' });
    return;
  } else {
    window.count += 1;
  }

  if (rateWindows.size > 1000) {
    for (const [address, entry] of rateWindows) {
      if (now - entry.startedAt >= 60_000) rateWindows.delete(address);
    }
  }
  next();
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes, files: 1, fields: 1, fieldSize: 1_048_576, parts: 2 },
  fileFilter(req, file, callback) {
    if (file.mimetype !== 'application/pdf') {
      callback(Object.assign(new Error('Upload a PDF file.'), { status: 415 }));
      return;
    }
    callback(null, true);
  },
});

function parseEdits(value, pageCount) {
  let edits;
  try {
    edits = JSON.parse(value);
  } catch {
    throw Object.assign(new Error('The PDF edit instructions are invalid.'), { status: 400 });
  }

  if (!Array.isArray(edits) || edits.length > maxEdits) {
    throw Object.assign(new Error(`A request may contain up to ${maxEdits} text edits.`), { status: 400 });
  }

  return edits.map((edit) => {
    if (!edit || typeof edit !== 'object' || Array.isArray(edit)) {
      throw Object.assign(new Error('An edit instruction is invalid.'), { status: 400 });
    }

    const { operation, page, x, y, width, height, fontSize, text } = edit;
    if (!['add', 'replace', 'delete'].includes(operation) ||
        !Number.isInteger(page) || page < 1 || page > pageCount) {
      throw Object.assign(new Error('An edit contains an invalid operation or page number.'), { status: 400 });
    }

    if (![x, y, width, height, fontSize].every(Number.isFinite) ||
        x < 0 || y < 0 || width <= 0 || height <= 0 ||
        width > 20_000 || height > 20_000 ||
        fontSize < 1 || fontSize > 144 ||
        (operation === 'add' || operation === 'replace') &&
          (typeof text !== 'string' || !text.trim() || text.length > maxTextLength)) {
      throw Object.assign(new Error('An edit contains invalid text or coordinates.'), { status: 400 });
    }

    return { operation, page, x, y, width, height, fontSize, text };
  });
}

app.post('/api/pdf/edit', rateLimit, upload.single('pdf'), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file || !file.buffer.length) {
      res.status(400).json({ error: 'Choose a PDF before exporting.' });
      return;
    }
    if (!file.buffer.subarray(0, 1024).toString('latin1').includes('%PDF-')) {
      res.status(415).json({ error: 'The uploaded file is not a valid PDF.' });
      return;
    }

    let pdf;
    try {
      pdf = await PDFDocument.load(file.buffer, {
        updateMetadata: false,
        throwOnInvalidObject: true,
      });
    } catch {
      res.status(400).json({ error: 'This PDF could not be opened. It may be damaged or password-protected.' });
      return;
    }

    const pages = pdf.getPages();
    if (!pages.length || pages.length > maxPages) {
      res.status(413).json({ error: `PDFs must contain between 1 and ${maxPages} pages.` });
      return;
    }

    const edits = parseEdits(req.body?.edits, pages.length);
    for (const edit of edits) {
      const page = pages[edit.page - 1];
      const { width, height } = page.getSize();
      if (edit.x + edit.width > width + 1 || edit.y + edit.height > height + 1) {
        res.status(400).json({ error: `An edit on page ${edit.page} falls outside the page.` });
        return;
      }
    }

    if (edits.length) {
      const font = await pdf.embedFont(StandardFonts.Helvetica);

      // Clear changed text regions first so the source text is not visibly
      // drawn underneath replacements. This is visual masking, not secure
      // permanent redaction of the original PDF content stream.
      for (const edit of edits) {
        if (edit.operation === 'add') continue;
        const page = pages[edit.page - 1];
        const pageSize = page.getSize();
        const left = Math.max(0, edit.x - 1);
        const bottom = Math.max(0, edit.y - 1);
        const right = Math.min(pageSize.width, edit.x + edit.width + 1);
        const top = Math.min(pageSize.height, edit.y + edit.height + 1);
        page.drawRectangle({
          x: left,
          y: bottom,
          width: right - left,
          height: top - bottom,
          color: rgb(1, 1, 1),
          borderWidth: 0,
        });
      }

      for (const edit of edits) {
        if (edit.operation === 'delete') continue;
        try {
          font.encodeText(edit.text);
        } catch {
          res.status(422).json({ error: 'This text uses characters the built-in PDF font cannot display.' });
          return;
        }

        const page = pages[edit.page - 1];
        const baseline = edit.y + Math.max(0, (edit.height - edit.fontSize) / 2);
        page.drawText(edit.text, {
          x: edit.x + 1,
          y: baseline,
          size: edit.fontSize,
          font,
          color: rgb(0, 0, 0),
          maxWidth: Math.max(1, edit.width - 2),
          lineHeight: edit.fontSize * 1.2,
        });
      }
    }

    const result = Buffer.from(await pdf.save());
    res
      .status(200)
      .type('application/pdf')
      .set({
        'Content-Disposition': 'attachment; filename="edited-pdfcraft-document.pdf"',
        'Content-Length': String(result.length),
        'Cache-Control': 'no-store, private',
        'Content-Security-Policy': "default-src 'none'",
      })
      .send(result);
  } catch (error) {
    next(error);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.all('*path', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.set('Allow', 'GET, HEAD').status(405).send('Method not allowed');
    return;
  }

  let filename;
  try {
    filename = decodeURIComponent(new URL(req.originalUrl, 'http://server').pathname).slice(1);
    if (!filename || filename.endsWith('/')) filename += 'index.html';
  } catch {
    res.status(400).send('Bad request');
    return;
  }
  if (!publicFiles.has(filename)) {
    res.status(404).send('Not found');
    return;
  }

  res.sendFile(path.join(root, filename), (error) => {
    if (error && !res.headersSent) next(error);
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error instanceof multer.MulterError
    ? error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    : error.status || 500;
  const message = status >= 500 ? 'The PDF could not be processed.' : error.message;
  if (status >= 500) console.error('PDF request failed:', error.name);
  res.status(status).json({ error: message });
});

if (require.main === module) {
  app.listen(5000, '0.0.0.0', () => {
    console.log('PDF EDIT TOOL is running on port 5000');
  });
}

module.exports = { app };
