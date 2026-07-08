const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);

function isHeicFilename(filename) {
  return HEIC_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function isImageFilename(filename) {
  return IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

function convertHeicToJpeg(inputPath, outputPath) {
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "85", inputPath, "--out", outputPath], {
    stdio: "pipe",
  });
  return outputPath;
}

function normalizeUploadedImage(filePath) {
  if (!isHeicFilename(filePath)) {
    return path.basename(filePath);
  }

  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const outputPath = path.join(dir, `${base}.jpg`);

  try {
    convertHeicToJpeg(filePath, outputPath);
  } catch (_error) {
    fs.unlinkSync(filePath);
    throw new Error("HEIC conversion is not available on this server. Upload JPEG or PNG instead.");
  }

  fs.unlinkSync(filePath);
  return path.basename(outputPath);
}

module.exports = {
  HEIC_EXTENSIONS,
  IMAGE_EXTENSIONS,
  isHeicFilename,
  isImageFilename,
  convertHeicToJpeg,
  normalizeUploadedImage,
};
