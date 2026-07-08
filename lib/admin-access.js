const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KEY_PATH = path.join(
  process.env.STORAGE_PATH || path.join(__dirname, ".."),
  "data",
  "access-key.json"
);

function generateKey() {
  return crypto.randomBytes(18).toString("base64url");
}

function getAdminAccessKey() {
  if (process.env.ADMIN_ACCESS_KEY) {
    return process.env.ADMIN_ACCESS_KEY.trim();
  }

  fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true });

  if (fs.existsSync(KEY_PATH)) {
    const saved = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
    if (saved && saved.key) {
      return saved.key;
    }
  }

  const key = generateKey();
  fs.writeFileSync(KEY_PATH, JSON.stringify({ key }, null, 2));
  return key;
}

module.exports = { getAdminAccessKey };
