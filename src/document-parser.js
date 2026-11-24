import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const scriptPath = fileURLToPath(new URL('../scripts/extract-pdf-text.py', import.meta.url));

export async function parseDocument({ fileData, fileName = 'document.txt' }) {
  if (!fileData || typeof fileData !== 'string') {
    throw new Error('No document content provided.');
  }

  const isPdf = fileName.toLowerCase().endsWith('.pdf') ||
    fileData.startsWith('data:application/pdf') ||
    fileData.startsWith('JVBERi0'); // base64 for %PDF-

  if (isPdf) {
    let base64Content = fileData;
    if (fileData.includes(',')) {
      base64Content = fileData.split(',')[1];
    }
    const buffer = Buffer.from(base64Content, 'base64');
    if (!buffer.subarray(0, 5).toString('ascii').startsWith('%PDF-')) {
      throw new Error('Uploaded file is not a valid PDF.');
    }
    const tempFile = join(tmpdir(), `sdlc-upload-${randomUUID()}.pdf`);
    await writeFile(tempFile, buffer);
    try {
      const { stdout } = await execute('python', [scriptPath, tempFile], {
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf8'
      });
      const text = stdout.trim();
      if (!text) {
        throw new Error('Could not extract readable text from this PDF (it might be scanned/image-only).');
      }
      return text;
    } finally {
      await unlink(tempFile).catch(() => {});
    }
  }

  // Plain text / .txt handling
  let text = fileData;
  if (fileData.startsWith('data:text/') && fileData.includes(',')) {
    const base64Content = fileData.split(',')[1];
    text = Buffer.from(base64Content, 'base64').toString('utf8');
  } else if (/^[A-Za-z0-9+/=]+$/.test(fileData.trim()) && fileData.length % 4 === 0 && fileData.length > 50) {
    // Possibly base64 encoded text
    try {
      const decoded = Buffer.from(fileData, 'base64').toString('utf8');
      if (!/[\x00-\x08\x0E-\x1F]/.test(decoded)) {
        text = decoded;
      }
    } catch {}
  }

  text = text.trim();
  if (!text) {
    throw new Error('The uploaded document is empty.');
  }
  return text;
}
