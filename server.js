require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { initDatabase, getPublicContent, UPLOADS_DIR } = require("./lib/database");
const { getAdminAccessKey } = require("./lib/admin-access");
const { normalizeUploadedImage, isHeicFilename } = require("./lib/image-convert");

const PORT = Number(process.env.PORT || 8080);
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-production";
const ADMIN_ACCESS_KEY = getAdminAccessKey();
const ADMIN_API_BASE = `/api/${ADMIN_ACCESS_KEY}`;

const { store, seededAdmin } = initDatabase();
const app = express();

app.set("trust proxy", 1);

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function (_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      /^image\/(jpeg|png|webp|gif|heic|heif)$/.test(file.mimetype) ||
      isHeicFilename(file.originalname) ||
      [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"].includes(ext)
    ) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image uploads are allowed."));
  },
});

function photoResponse(store, photo) {
  return {
    ...photo,
    visible: Boolean(photo.visible),
    url: `/uploads/${photo.filename}`,
    slot: store.photoSlot(photo),
  };
}

function addUploadedPhoto(store, file, options) {
  const filename = normalizeUploadedImage(path.join(UPLOADS_DIR, file.filename));
  const title = String(options.title || "Untitled project").trim() || "Untitled project";
  const slot = options.slot || "gallery";

  if (slot === "hero") {
    store.clearHeroPlacement();
  } else if (/^featured-[1-3]$/.test(slot)) {
    const slotIndex = Number(slot.split("-")[1]) - 1;
    store.clearProjectSlot(slotIndex);
  }

  const placement =
    slot === "hero" ? "hero" : /^featured-[1-3]$/.test(slot) ? "project" : "gallery";
  const sortOrder =
    placement === "project" ? Number(slot.split("-")[1]) - 1 : Number(options.sort_order || 0);

  return store.addPhoto({
    filename,
    title,
    placement,
    sort_order: sortOrder,
    visible: true,
  });
}

app.use(express.json());
app.use(
  session({
    name: "cec_admin",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 12,
    },
  })
);

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminId) {
    next();
    return;
  }
  res.status(401).json({ error: "Authentication required." });
}

app.get("/health", function (_req, res) {
  res.json({ ok: true });
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildGalleryCardsHtml(gallery) {
  return gallery
    .map(function (photo) {
      const title = escapeHtml(photo.title);
      const url = escapeHtml(`/uploads/${photo.filename}`);
      return `<figure class="gallery-card"><img src="${url}" alt="${title}" loading="lazy" decoding="async" /><figcaption>${title}</figcaption></figure>`;
    })
    .join("");
}

function servePublicIndex(_req, res) {
  const content = getPublicContent(store);
  let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

  if (content.gallery.length) {
    html = html.replace(
      '<div class="gallery-track" id="gallery-grid"></div>',
      `<div class="gallery-track" id="gallery-grid">${buildGalleryCardsHtml(content.gallery)}</div>`
    );
    html = html.replace('id="gallery-scroller" hidden', 'id="gallery-scroller"');
    html = html.replace(
      /<p class="gallery-status reveal" id="gallery-status">[\s\S]*?<\/p>\s*/i,
      ""
    );
  }

  res.set("Cache-Control", "no-cache");
  res.type("html").send(html);
}

app.get("/", servePublicIndex);
app.get("/index.html", servePublicIndex);

app.get("/api/content", function (_req, res) {
  const content = getPublicContent(store);
  res.json({
    adminPath: `/${ADMIN_ACCESS_KEY}`,
    hero: content.hero
      ? { ...content.hero, url: `/uploads/${content.hero.filename}` }
      : null,
    projects: content.projects.map(function (photo) {
      return { ...photo, url: `/uploads/${photo.filename}` };
    }),
    gallery: content.gallery.map(function (photo) {
      return { ...photo, url: `/uploads/${photo.filename}` };
    }),
  });
});

app.post("/api/contact", function (req, res) {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim();
  const projectType = String(req.body.project || req.body.project_type || "").trim();
  const message = String(req.body.message || "").trim();

  if (!name || !email || !projectType || !message) {
    res.status(400).json({ error: "All fields are required." });
    return;
  }

  const submission = store.addSubmission({
    name,
    email,
    project_type: projectType,
    message,
  });

  res.status(201).json({ id: submission.id });
});

app.post(`${ADMIN_API_BASE}/login`, function (req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = store.getAdminByEmail(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  req.session.adminId = user.id;
  req.session.adminEmail = user.email;
  res.json({ email: user.email });
});

app.post(`${ADMIN_API_BASE}/logout`, function (req, res) {
  req.session.destroy(function () {
    res.json({ ok: true });
  });
});

app.get(`${ADMIN_API_BASE}/session`, function (req, res) {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  res.json({ email: req.session.adminEmail });
});

app.get(`${ADMIN_API_BASE}/account`, requireAdmin, function (req, res) {
  const user = store.getAdminById(req.session.adminId);
  if (!user) {
    res.status(404).json({ error: "Account not found." });
    return;
  }
  res.json({ email: user.email });
});

app.patch(`${ADMIN_API_BASE}/account`, requireAdmin, function (req, res) {
  const user = store.getAdminById(req.session.adminId);
  if (!user) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  const currentPassword = String(req.body.current_password || "");
  const newEmail = req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : null;
  const newPassword = req.body.new_password !== undefined ? String(req.body.new_password) : null;

  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  if (!newEmail && !newPassword) {
    res.status(400).json({ error: "Provide a new email and/or new password." });
    return;
  }

  if (newEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }
    const existing = store.getAdminByEmail(newEmail);
    if (existing && existing.id !== user.id) {
      res.status(400).json({ error: "That email is already in use." });
      return;
    }
  }

  if (newPassword && newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters." });
    return;
  }

  const updates = {};
  if (newEmail) {
    updates.email = newEmail;
  }
  if (newPassword) {
    updates.password_hash = bcrypt.hashSync(newPassword, 10);
  }

  const updated = store.updateAdmin(user.id, updates);
  req.session.adminEmail = updated.email;
  res.json({ email: updated.email });
});

app.get(`${ADMIN_API_BASE}/photos`, requireAdmin, function (_req, res) {
  const photos = store.listPhotos().map(function (photo) {
    return photoResponse(store, photo);
  });
  res.json({ photos });
});

app.post(`${ADMIN_API_BASE}/photos`, requireAdmin, upload.single("image"), function (req, res) {
  if (!req.file) {
    res.status(400).json({ error: "Image file is required." });
    return;
  }

  const slot = req.body.slot || req.body.placement || "gallery";
  const photo = addUploadedPhoto(store, req.file, {
    title: req.body.title,
    slot: slot === "project" ? req.body.slot || "gallery" : slot,
  });

  res.status(201).json(photoResponse(store, photo));
});

app.post(`${ADMIN_API_BASE}/photos/bulk`, requireAdmin, upload.array("images", 50), function (req, res) {
  const files = req.files || [];
  if (!files.length) {
    res.status(400).json({ error: "At least one image is required." });
    return;
  }

  const defaultSlot = req.body.slot || "gallery";
  const titlePrefix = String(req.body.title_prefix || "").trim();
  const added = files.map(function (file, index) {
    const baseTitle = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const title = titlePrefix
      ? `${titlePrefix}${files.length > 1 ? ` ${index + 1}` : ""}`.trim()
      : baseTitle || "Untitled project";
    const photo = addUploadedPhoto(store, file, { title, slot: defaultSlot });
    return photoResponse(store, photo);
  });

  res.status(201).json({ photos: added, count: added.length });
});

app.patch(`${ADMIN_API_BASE}/photos/:id`, requireAdmin, function (req, res) {
  const photo = store.getPhoto(req.params.id);
  if (!photo) {
    res.status(404).json({ error: "Photo not found." });
    return;
  }

  let updated = photo;

  if (req.body.slot !== undefined) {
    const slot = String(req.body.slot);
    if (!["hero", "featured-1", "featured-2", "featured-3", "gallery"].includes(slot)) {
      res.status(400).json({ error: "Invalid slot." });
      return;
    }
    updated = store.assignPhotoSlot(photo.id, slot);
  } else if (req.body.placement !== undefined) {
    const placement = String(req.body.placement);
    if (!["hero", "project", "gallery"].includes(placement)) {
      res.status(400).json({ error: "Invalid placement." });
      return;
    }
    if (placement === "hero" && photo.placement !== "hero") {
      store.clearHeroPlacement(photo.id);
    }
    updated = store.updatePhoto(photo.id, {
      placement,
      sort_order:
        req.body.sort_order !== undefined ? Number(req.body.sort_order) : photo.sort_order,
    });
  }

  if (req.body.title !== undefined) {
    updated = store.updatePhoto(photo.id, { title: String(req.body.title).trim() || photo.title });
  }

  if (req.body.visible !== undefined) {
    updated = store.updatePhoto(photo.id, { visible: Boolean(req.body.visible) });
  }

  res.json(photoResponse(store, updated));
});

app.delete(`${ADMIN_API_BASE}/photos/:id`, requireAdmin, function (req, res) {
  const photo = store.deletePhoto(req.params.id);
  if (!photo) {
    res.status(404).json({ error: "Photo not found." });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, photo.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  res.json({ ok: true });
});

app.get(`${ADMIN_API_BASE}/submissions`, requireAdmin, function (_req, res) {
  res.json({ submissions: store.listSubmissions() });
});

app.patch(`${ADMIN_API_BASE}/submissions/:id`, requireAdmin, function (req, res) {
  const submission = store.getSubmission(req.params.id);
  if (!submission) {
    res.status(404).json({ error: "Submission not found." });
    return;
  }

  const status = req.body.status ? String(req.body.status) : submission.status;
  if (!["new", "read", "responded"].includes(status)) {
    res.status(400).json({ error: "Invalid status." });
    return;
  }

  const updated = store.updateSubmission(submission.id, { status });
  res.json(updated);
});

function serveAdminPage(_req, res) {
  const html = fs
    .readFileSync(path.join(__dirname, "admin.html"), "utf8")
    .replace(
      "</head>",
      `<script>window.ADMIN_API_BASE=${JSON.stringify(ADMIN_API_BASE)};</script></head>`
    )
    .replace('href="admin.css"', `href="/${ADMIN_ACCESS_KEY}/assets/admin.css"`)
    .replace('src="admin.js"', `src="/${ADMIN_ACCESS_KEY}/assets/admin.js"`);
  res.type("html").send(html);
}

app.get(`/${ADMIN_ACCESS_KEY}`, serveAdminPage);
app.get(`/${ADMIN_ACCESS_KEY}/`, serveAdminPage);
app.get(`/${ADMIN_ACCESS_KEY}/assets/admin.css`, function (_req, res) {
  res.sendFile(path.join(__dirname, "admin.css"));
});
app.get(`/${ADMIN_ACCESS_KEY}/assets/admin.js`, function (_req, res) {
  res.sendFile(path.join(__dirname, "admin.js"));
});

app.use(function (req, res, next) {
  if (
    /^\/admin\.html$/i.test(req.path) ||
    /^\/admin\.js$/i.test(req.path) ||
    /^\/admin\.css$/i.test(req.path) ||
    /^\/api\/admin(?:\/|$)/i.test(req.path)
  ) {
    res.status(404).send("Not found");
    return;
  }
  next();
});

app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use(express.static(__dirname));

app.use(function (err, _req, res, next) {
  if (!err) {
    next();
    return;
  }
  if (err instanceof multer.MulterError || /upload/i.test(err.message)) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Server error." });
});

app.listen(PORT, function () {
  console.log(`Cotton Elder site running at http://localhost:${PORT}`);
  console.log(`Private admin URL: http://localhost:${PORT}/${ADMIN_ACCESS_KEY}`);
  if (seededAdmin) {
    console.log(`Admin account created: ${seededAdmin.email}`);
    if (seededAdmin.password) {
      console.log(`Temporary password: ${seededAdmin.password}`);
      console.log("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to customize.");
    }
  }
});
