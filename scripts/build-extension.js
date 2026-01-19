/**
 * Build Extension Script (ES Module)
 * Zips the Chrome Extension and places it in public folder for download
 */

import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXTENSION_DIR = path.join(__dirname, '../merchize-fulfillment-extension');
const OUTPUT_DIR = path.join(__dirname, '../public');
const OUTPUT_FILE = 'merchize-extension.zip';

console.log('🔧 Building POD Merchize Extension...');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('✅ Created public directory');
}

const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE);

// Remove old zip if exists
if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log('🗑️  Removed old extension zip');
}

// Create write stream
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
});

// Listen for events
output.on('close', () => {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log('');
    console.log('✅ Extension built successfully!');
    console.log(`📦 Size: ${sizeInMB} MB`);
    console.log(`📍 Location: ${outputPath}`);
    console.log(`🌐 Download URL: /merchize-extension.zip`);
    console.log('');
});

archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
        console.warn('Warning:', err);
    } else {
        throw err;
    }
});

archive.on('error', (err) => {
    throw err;
});

// Pipe archive to file
archive.pipe(output);

// Add extension files to archive
console.log('📦 Packaging extension files...');

// Add all files from extension directory
archive.directory(EXTENSION_DIR, false);

// Finalize archive
archive.finalize();
