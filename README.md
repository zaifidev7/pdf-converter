# 📄 FileToPDF — Universal File Converter

> Upload any file. Get a PDF. Instantly.

A free, open-source web app that converts DOCX, XLSX, PPTX, images, TXT, HTML, and Markdown files to PDF — all in the browser, with drag & drop, bulk upload, and automatic download.

---

## ✨ Features

- 🗂️ **Bulk upload** — convert multiple files at once
- 🖱️ **Drag & drop** UI
- 📥 **Auto-download** — PDFs save directly to your Downloads folder
- 📊 Progress indicators per file
- 🔒 Files are deleted from the server after conversion
- 🌐 Deployable for free on Render.com

## 📁 Supported File Types

| Type | Extensions | Converter Used |
|------|------------|----------------|
| Word Documents | .docx, .doc | LibreOffice |
| Spreadsheets | .xlsx, .xls | LibreOffice |
| Presentations | .pptx, .ppt | LibreOffice |
| Images | .jpg, .png, .gif, .bmp, .webp | Sharp + PDFKit |
| Plain Text | .txt | PDFKit |
| Markdown | .md | marked + LibreOffice |
| HTML | .html | LibreOffice |

---

## 🚀 Quick Start (Run Locally)

### Step 1 — Install Node.js

Download from: https://nodejs.org (choose the LTS version)

Verify it's installed:
```bash
node --version   # Should show v18 or higher
npm --version    # Should show v9 or higher
```

### Step 2 — Install LibreOffice

**macOS:**
```bash
brew install --cask libreoffice
```

**Ubuntu/Debian Linux:**
```bash
sudo apt-get update
sudo apt-get install -y libreoffice
```

**Windows:**
Download from: https://www.libreoffice.org/download/download/
Install, then add to your PATH.

### Step 3 — Clone and Run

```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/pdf-converter.git
cd pdf-converter

# Install Node.js packages
npm install

# Start the server
npm start
```

### Step 4 — Open in Browser

Visit: **http://localhost:3000**

That's it! Upload files and watch the magic happen.

---

## 📂 Project Structure

```
pdf-converter/
│
├── public/
│   └── index.html       ← Frontend (HTML + CSS + JavaScript)
│
├── server.js            ← Backend server (Node.js + Express)
├── package.json         ← Project config and dependencies
├── render.yaml          ← Render.com deployment config
├── .gitignore           ← Files to exclude from Git
└── README.md            ← This file
```

### How It Works (Simple Explanation)

```
Browser (User)
     │
     │  1. User drops files onto the page
     │  2. JavaScript collects files and sends them to:
     ▼
POST /convert  (our backend endpoint)
     │
     │  3. multer saves the file temporarily
     │  4. Server detects file type by extension
     │  5. Calls the right converter:
     │     • .docx/.xlsx/.pptx → LibreOffice
     │     • .jpg/.png/etc.    → Sharp + PDFKit
     │     • .txt              → PDFKit
     │     • .md               → marked → LibreOffice
     │     • .html             → LibreOffice
     │  6. PDF is created
     │  7. PDF is sent back as a binary response
     ▼
Browser (User)
     │
     │  8. JavaScript receives the PDF
     │  9. Creates a fake download link and clicks it
     │  10. PDF saves to Downloads folder
     ▼
     ✓ Done!
```

---

## 🌐 Deploy for Free on Render.com

### Prerequisites
- A GitHub account (free): https://github.com
- A Render.com account (free): https://render.com

### Step-by-Step

1. **Push your code to GitHub** (see GitHub section below)

2. **Go to Render.com** and click "New +" → "Web Service"

3. **Connect your GitHub** account when prompted

4. **Select your repository** (pdf-converter)

5. **Render reads `render.yaml` automatically** — it will:
   - Install LibreOffice
   - Run `npm install`
   - Start the server

6. **Click "Create Web Service"**

7. Wait 5–10 minutes for the build to finish.

8. Your app is live at: `https://your-app-name.onrender.com`

> ⚠️ **Free tier note**: Render's free tier "spins down" after 15 minutes of inactivity. The first request after a sleep takes ~30 seconds. This is normal and free.

---

## 📦 GitHub Setup Guide

### Step 1 — Create a new repository on GitHub

1. Go to https://github.com and sign in
2. Click the "+" icon → "New repository"
3. Name it: `pdf-converter`
4. Keep it Public (so Render can read it)
5. Click "Create repository"

### Step 2 — Set up Git locally

```bash
# Inside the pdf-converter folder:
git init
git add .
git commit -m "Initial commit: file to PDF converter"
```

### Step 3 — Connect and push

```bash
# Replace YOUR-USERNAME with your actual GitHub username
git remote add origin https://github.com/YOUR-USERNAME/pdf-converter.git
git branch -M main
git push -u origin main
```

### Step 4 — Future updates

After making changes:
```bash
git add .
git commit -m "Describe your change here"
git push
```

---

## 🧪 Testing Guide

### Test each file type

| File Type | Test | Expected Result |
|-----------|------|-----------------|
| .docx | Upload a Word document | PDF with same content |
| .xlsx | Upload an Excel file | PDF with table layout |
| .pptx | Upload a PowerPoint | PDF with slides |
| .txt | Upload a text file | Clean PDF with text |
| .jpg/.png | Upload a photo | PDF sized to the image |
| .md | Upload a Markdown file | PDF with formatted HTML |

### Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "LibreOffice is not installed" | LibreOffice missing | Install it (see Step 2 above) |
| "File type not supported" | Wrong file extension | Use a supported format |
| "File too large" | File > 50 MB | Compress the file first |
| Port 3000 in use | Another app running | Change PORT in server.js |
| Blank PDF | LibreOffice rendering issue | Try re-saving the source file |

---

## 🔧 Common Beginner Mistakes to Avoid

1. ❌ **Forgetting to run `npm install`** — always do this first
2. ❌ **LibreOffice not in PATH** — make sure `libreoffice --version` works in terminal
3. ❌ **Uploading huge files** — keep files under 50 MB
4. ❌ **Not cleaning up temp files** — our server does this automatically
5. ❌ **Using `var` in JavaScript** — prefer `const` and `let`
6. ❌ **Not handling errors** — always wrap async code in try/catch

---

## 📜 License

MIT License — free to use, modify, and share.

---

## 🙏 Built With

- [Express.js](https://expressjs.com/) — Web server
- [Multer](https://github.com/expressjs/multer) — File upload handling
- [LibreOffice](https://www.libreoffice.org/) — Office to PDF conversion
- [Sharp](https://sharp.pixelplumbing.com/) — Image processing
- [PDFKit](https://pdfkit.org/) — PDF generation
- [Marked](https://marked.js.org/) — Markdown to HTML

---

*Made with ❤️ — open source and free forever*
