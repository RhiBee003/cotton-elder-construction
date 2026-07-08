#!/usr/bin/env node
/**
 * Import photos from a folder (default: ~/Desktop/CECpix) into uploads/ and site.json.
 * Converts HEIC to JPEG via macOS sips. Skips video files.
 *
 * Usage: node scripts/import-cec-photos.js [source-folder]
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { initDatabase, UPLOADS_DIR } = require("../lib/database");
const { isImageFilename, convertHeicToJpeg, isHeicFilename } = require("../lib/image-convert");

const sourceDir = process.argv[2] || path.join(process.env.HOME || "", "Desktop", "CECpix");

function titleFromFilename(filename) {
  return path
    .basename(filename, path.extname(filename))
    .replace(/^IMG[_\s-]*/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Project photo";
}

function uniqueFilename(ext) {
  return `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
}

function importFile(store, filePath) {
  const originalName = path.basename(filePath);
  if (!isImageFilename(originalName)) {
    return null;
  }

  const existing = store.listPhotos().find(function (photo) {
    return photo.source_name === originalName;
  });
  if (existing) {
    console.log(`  skip (already imported): ${originalName}`);
    return null;
  }

  const ext = isHeicFilename(originalName) ? ".jpg" : path.extname(originalName).toLowerCase();
  const filename = uniqueFilename(ext);
  const destPath = path.join(UPLOADS_DIR, filename);

  if (isHeicFilename(originalName)) {
    convertHeicToJpeg(filePath, destPath);
  } else {
    fs.copyFileSync(filePath, destPath);
  }

  const photo = store.addPhoto({
    filename,
    title: titleFromFilename(originalName),
    placement: "gallery",
    sort_order: 0,
    visible: true,
    source_name: originalName,
  });

  console.log(`  added: ${originalName} → ${filename}`);
  return photo;
}

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.error(`Source folder not found: ${sourceDir}`);
    process.exit(1);
  }

  const { store } = initDatabase();
  const files = fs
    .readdirSync(sourceDir)
    .map(function (name) {
      return path.join(sourceDir, name);
    })
    .filter(function (filePath) {
      return fs.statSync(filePath).isFile();
    })
    .sort();

  console.log(`Importing from ${sourceDir}`);
  let count = 0;
  files.forEach(function (filePath) {
    const result = importFile(store, filePath);
    if (result) {
      count += 1;
    }
  });

  console.log(`Done. ${count} new photo(s) added to the library.`);
}

main();
