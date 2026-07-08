import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const ALBUM_URL = "https://share.icloud.com/photos/09ev5Nx3i6tKxK9AkY05CrThg";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "images");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {}
          download(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {}
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", reject);
  });
}

async function collectPhotoUrls(page) {
  const urls = new Set();
  page.on("response", (res) => {
    const url = res.url();
    if (/icloud-content\.com/.test(url) && res.status() === 200) {
      urls.add(url);
    }
  });

  await page.goto(ALBUM_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(12000);

  const html = await page.content();
  for (const match of html.matchAll(/https:\/\/[^"'\s]+icloud-content\.com[^"'\s]+public\.jpeg[^"'\s]*/g)) {
    urls.add(match[0].replace(/\\u0026/g, "&"));
  }

  return [...urls];
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const urls = await collectPhotoUrls(page);
  await browser.close();

  if (!urls.length) {
    throw new Error("No photos found. Check that the iCloud album is publicly shared.");
  }

  const downloaded = [];
  for (let i = 0; i < urls.length; i += 1) {
    const dest = path.join(OUT_DIR, `photo-${String(i + 1).padStart(2, "0")}.jpg`);
    try {
      await download(urls[i], dest);
      if (fs.statSync(dest).size < 8000) {
        fs.unlinkSync(dest);
        continue;
      }
      downloaded.push(dest);
    } catch {
      // skip failed downloads
    }
  }

  if (!downloaded.length) {
    throw new Error("Could not download any photos from the album.");
  }

  const picks = {
    "hero.jpg": downloaded[0],
    "project-1.jpg": downloaded[1] || downloaded[0],
    "project-2.jpg": downloaded[2] || downloaded[0],
    "project-3.jpg": downloaded[3] || downloaded[0],
  };

  for (const [name, source] of Object.entries(picks)) {
    fs.copyFileSync(source, path.join(OUT_DIR, name));
  }

  console.log(`Synced ${downloaded.length} photos from iCloud.`);
  console.log("Updated hero.jpg and project-1.jpg through project-3.jpg");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
