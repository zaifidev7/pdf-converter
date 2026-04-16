/**
 * ╔════════════════════════════════════════════════╗
 * ║        FileToPDF — Node.js Backend Server       ║
 * ║                                                  ║
 * ║  What this file does:                            ║
 * ║  1. Serves the HTML frontend                     ║
 * ║  2. Receives uploaded files via POST /convert    ║
 * ║  3. Detects file type                            ║
 * ║  4. Calls the right converter                    ║
 * ║  5. Sends back the PDF                           ║
 * ╚════════════════════════════════════════════════╝
 */

// ─── IMPORT LIBRARIES ─────────────────────────────────────────────────────────
// These are like tools we pull out of a toolbox
// We installed them with: npm install
const libreOfficePath = "C:\\Program Files\\LibreOffice\\program\\soffice.exe";

const express  = require('express');   // Web server framework
const multer   = require('multer');    // Handles file uploads
const path     = require('path');      // Works with file paths
const fs       = require('fs');        // Reads/writes files from disk
const { execSync, execFile } = require('child_process'); // Runs system commands
const sharp    = require('sharp');     // Image processing (converts images → PDF)
const PDFKit   = require('pdfkit');    // Creates PDFs from text
const { marked } = require('marked'); // Converts Markdown → HTML

// ─── APP SETUP ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// Tell Express to serve static files (our HTML/CSS/JS) from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// ─── FILE UPLOAD CONFIG ───────────────────────────────────────────────────────
// multer handles multipart/form-data (the format browsers use to upload files).
// We store uploaded files in the /uploads folder temporarily.

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    // Create the folder if it doesn't exist
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Give each uploaded file a unique name to avoid collisions
    // Example: "report.docx" → "1704067200000_report.docx"
    const uniqueName = Date.now() + '_' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  },
});

// File size limit: 50 MB
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // These are the file types we allow
    const allowed = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',          // .xlsx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/msword',           // .doc
      'application/vnd.ms-excel',     // .xls
      'application/vnd.ms-powerpoint',// .ppt
      'text/plain',                   // .txt
      'text/html',                    // .html
      'text/markdown',                // .md
      'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', // images
    ];

    // Also check file extension (some browsers send wrong MIME types)
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.docx','.doc','.xlsx','.xls','.pptx','.ppt',
                         '.txt','.html','.md','.jpg','.jpeg','.png',
                         '.gif','.bmp','.webp'];

    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true); // Accept the file
    } else {
      cb(new Error(`File type not supported: ${file.originalname}`));
    }
  },
});

// ─── HELPER: DELETE FILE SAFELY ───────────────────────────────────────────────
// After conversion, we clean up temp files to save disk space
function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn('Could not delete:', filePath, e.message);
  }
}

// ─── CHECK IF LIBREOFFICE IS INSTALLED ────────────────────────────────────────
function libreOfficeAvailable() {
  try {
    // Try running LibreOffice. If it's not installed, this throws.
    execSync(`"${libreOfficePath}" --version`, { stdio: 'pipe', timeout: 5000 });

    return true;
  } catch {
    return false;
  }
}

const HAS_LIBREOFFICE = libreOfficeAvailable();
console.log('LibreOffice available:', HAS_LIBREOFFICE);

// ─── CONVERTER FUNCTIONS ──────────────────────────────────────────────────────

/**
 * CONVERTER 1: Office Files (DOCX, XLSX, PPTX, DOC, XLS, PPT)
 *
 * LibreOffice is a free office suite that can run in "headless" mode
 * (no GUI, just command-line) to convert Office files to PDF.
 *
 * Command: libreoffice --headless --convert-to pdf input.docx --outdir /path/
 *
 * Returns: path to the created PDF file
 */
async function convertOfficeFile(inputPath, outputDir) {
  return new Promise((resolve, reject) => {
    if (!HAS_LIBREOFFICE) {
      return reject(new Error(
        'LibreOffice is not installed. See README for installation instructions.'
      ));
    }

    execFile(
      libreOfficePath,
      ['--headless', '--convert-to', 'pdf', inputPath, '--outdir', outputDir],
      { timeout: 60000 }, // 60 second timeout
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error('LibreOffice conversion failed: ' + (stderr || err.message)));
        }

        // LibreOffice names the output as: originalname_without_ext.pdf
        const baseName = path.basename(inputPath, path.extname(inputPath));
        const pdfPath  = path.join(outputDir, baseName + '.pdf');

        if (!fs.existsSync(pdfPath)) {
          return reject(new Error('PDF was not created by LibreOffice.'));
        }

        resolve(pdfPath);
      }
    );
  });
}

/**
 * CONVERTER 2: Images (JPG, PNG, GIF, BMP, WEBP)
 *
 * Sharp is a Node.js image processing library.
 * It converts images to PDF by wrapping them in a PDF file.
 *
 * Process:
 *   1. Read the image with sharp
 *   2. Convert it to a PNG buffer (normalized format)
 *   3. Embed it inside a PDF using PDFKit
 *
 * Returns: path to the created PDF file
 */
async function convertImageToPdf(inputPath, outputDir) {
  // Step 1: Get image dimensions so we can size the PDF correctly
  const meta = await sharp(inputPath).metadata();
  const { width, height } = meta;

  // Step 2: Convert image to PNG buffer (sharp handles all image formats)
  const imgBuffer = await sharp(inputPath).png().toBuffer();

  // Step 3: Create a PDF with PDFKit, sized to fit the image
  return new Promise((resolve, reject) => {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const pdfPath  = path.join(outputDir, baseName + '.pdf');

    // Create the PDF document with the image's dimensions
    const doc = new PDFKit({ size: [width, height], margin: 0 });
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream); // Connect PDF output to the file

    // Draw the image filling the entire page
    doc.image(imgBuffer, 0, 0, { width, height });

    doc.end(); // Finalize the PDF

    stream.on('finish', () => resolve(pdfPath));
    stream.on('error', reject);
  });
}

/**
 * CONVERTER 3: Plain Text (.txt)
 *
 * Uses PDFKit to create a PDF with the text content,
 * formatted with a clean monospace font and proper margins.
 *
 * Returns: path to the created PDF file
 */
async function convertTextToPdf(inputPath, outputDir) {
  // Read the text file content
  const text = fs.readFileSync(inputPath, 'utf-8');

  return new Promise((resolve, reject) => {
    const baseName = path.basename(inputPath, '.txt');
    const pdfPath  = path.join(outputDir, baseName + '.pdf');

    const doc    = new PDFKit({ size: 'A4', margin: 60 });
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);

    // Add a title
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(path.basename(inputPath), { align: 'center' })
      .moveDown(1.5);

    // Add the text content with a readable font
    doc
      .font('Courier')
      .fontSize(10)
      .text(text, {
        align: 'left',
        lineGap: 4,
      });

    doc.end();

    stream.on('finish', () => resolve(pdfPath));
    stream.on('error', reject);
  });
}

/**
 * CONVERTER 4: Markdown (.md)
 *
 * Strategy:
 *   1. Convert Markdown → HTML using the "marked" library
 *   2. Wrap it in a styled HTML template
 *   3. Save as .html, then use LibreOffice to convert HTML → PDF
 *
 * Falls back to plain text converter if LibreOffice is unavailable.
 *
 * Returns: path to the created PDF file
 */
async function convertMarkdownToPdf(inputPath, outputDir) {
  const md   = fs.readFileSync(inputPath, 'utf-8');
  const html = marked(md); // Convert Markdown syntax to HTML tags

  // Wrap HTML in a minimal styled page
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto;
           padding: 0 40px; line-height: 1.7; color: #222; }
    h1,h2,h3 { font-family: Arial, sans-serif; color: #111; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre  { background: #f4f4f4; padding: 16px; border-radius: 4px; overflow: auto; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }
  </style>
</head>
<body>${html}</body>
</html>`;

  // Write temp HTML file
  const tempHtml = path.join(outputDir, path.basename(inputPath, '.md') + '_temp.html');
  fs.writeFileSync(tempHtml, fullHtml);

  let pdfPath;
  try {
    pdfPath = await convertOfficeFile(tempHtml, outputDir);
  } finally {
    deleteFile(tempHtml); // Clean up temp HTML
  }

  return pdfPath;
}

/**
 * CONVERTER 5: HTML (.html)
 *
 * LibreOffice can open HTML files and export them as PDF.
 * This is the simplest approach — no extra processing needed.
 *
 * Returns: path to the created PDF file
 */
async function convertHtmlToPdf(inputPath, outputDir) {
  return convertOfficeFile(inputPath, outputDir);
}

// ─── MASTER CONVERTER ROUTER ──────────────────────────────────────────────────
/**
 * This function looks at the file extension and calls the right converter.
 * Think of it as a switchboard operator routing calls to the right department.
 */
async function convertToPdf(inputPath, outputDir) {
  const ext = path.extname(inputPath).toLowerCase();

  // Office documents → LibreOffice
  if (['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt'].includes(ext)) {
    return convertOfficeFile(inputPath, outputDir);
  }

  // Images → Sharp + PDFKit
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
    return convertImageToPdf(inputPath, outputDir);
  }

  // Plain text → PDFKit
  if (ext === '.txt') {
    return convertTextToPdf(inputPath, outputDir);
  }

  // Markdown → marked + LibreOffice
  if (ext === '.md') {
    return convertMarkdownToPdf(inputPath, outputDir);
  }

  // HTML → LibreOffice
  if (ext === '.html' || ext === '.htm') {
    return convertHtmlToPdf(inputPath, outputDir);
  }

  // Unknown file type
  throw new Error(`No converter available for "${ext}" files.`);
}

// ─── API ENDPOINT: POST /convert ─────────────────────────────────────────────
/**
 * This is the main route. When the frontend sends a file here:
 *  1. multer saves the file to /uploads
 *  2. We call convertToPdf()
 *  3. We send the PDF back to the browser
 *  4. We clean up temp files
 */
app.post('/convert', upload.single('file'), async (req, res) => {
  // "req.file" is set by multer with info about the uploaded file
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const inputPath  = req.file.path;   // Where multer saved the upload
  const outputDir  = path.join(__dirname, 'converted');

  // Create output folder if it doesn't exist
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  let pdfPath = null;

  try {
    console.log(`Converting: ${req.file.originalname}`);

    // Run the appropriate converter
    pdfPath = await convertToPdf(inputPath, outputDir);

    // Get the original file name without extension for the download name
    const originalBase = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const downloadName = originalBase + '.pdf';

    // Set headers so the browser knows this is a file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

    // Stream the PDF file to the response
    const stream = fs.createReadStream(pdfPath);
    stream.pipe(res);

    // After streaming is done, clean up temp files
    stream.on('end', () => {
      deleteFile(inputPath);
      deleteFile(pdfPath);
    });

    stream.on('error', (err) => {
      console.error('Stream error:', err);
      deleteFile(inputPath);
      if (pdfPath) deleteFile(pdfPath);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to stream PDF.' });
    });

  } catch (err) {
    console.error('Conversion failed:', err.message);

    // Clean up
    deleteFile(inputPath);
    if (pdfPath) deleteFile(pdfPath);

    res.status(500).json({ error: err.message });
  }
});

// ─── HEALTH CHECK ENDPOINT ────────────────────────────────────────────────────
// Useful for deployment platforms to verify the server is running
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    libreOffice: HAS_LIBREOFFICE,
    uptime: process.uptime(),
  });
});

// ─── ERROR HANDLING MIDDLEWARE ────────────────────────────────────────────────
// This catches errors thrown by multer (like file too large)
app.use((err, req, res, next) => {
  console.error('Middleware error:', err.message);
  res.status(400).json({ error: err.message });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║  FileToPDF Server running!             ║
  ║  → http://localhost:${PORT}              ║
  ║  LibreOffice: ${HAS_LIBREOFFICE ? '✓ installed' : '✗ not found'}         ║
  ╚═══════════════════════════════════════╝
  `);
});
