const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, "..");
const DATA_DIR = path.join(STORAGE_ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "site.json");
const UPLOADS_DIR = path.join(STORAGE_ROOT, "uploads");
const LEGACY_IMAGES_DIR = path.join(__dirname, "..", "images");
const SEED_GALLERY_DIR = path.join(__dirname, "..", "seed", "gallery");
const SEED_GALLERY_MANIFEST = path.join(__dirname, "..", "seed", "gallery.json");

const defaultDb = {
  admin_users: [],
  photos: [],
  submissions: [],
};

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function readDb() {
  ensureDirs();
  if (!fs.existsSync(DB_PATH)) {
    return structuredClone(defaultDb);
  }
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  ensureDirs();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function nextId(items) {
  return items.reduce(function (max, item) {
    return Math.max(max, Number(item.id) || 0);
  }, 0) + 1;
}

function seedPhotos(db) {
  if (db.photos.length > 0) {
    return;
  }

  const defaults = [
    { file: "hero.jpg", title: "Featured project", placement: "hero", sort_order: 0 },
    { file: "project-1.jpg", title: "Kitchen renovation", placement: "project", sort_order: 0 },
    { file: "project-2.jpg", title: "Bathroom remodel", placement: "project", sort_order: 1 },
    { file: "project-3.jpg", title: "Whole-home refresh", placement: "project", sort_order: 2 },
  ];

  defaults.forEach(function (item, index) {
    const legacyPath = path.join(LEGACY_IMAGES_DIR, item.file);
    const uploadPath = path.join(UPLOADS_DIR, item.file);
    if (!fs.existsSync(legacyPath)) {
      return;
    }
    if (!fs.existsSync(uploadPath)) {
      fs.copyFileSync(legacyPath, uploadPath);
    }
    db.photos.push({
      id: index + 1,
      filename: item.file,
      title: item.title,
      placement: item.placement,
      sort_order: item.sort_order,
      visible: true,
      created_at: new Date().toISOString(),
    });
  });
}

function seedGalleryPhotos(db) {
  const hasGallery = db.photos.some(function (photo) {
    return photo.placement === "gallery";
  });
  if (hasGallery || !fs.existsSync(SEED_GALLERY_MANIFEST)) {
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(SEED_GALLERY_MANIFEST, "utf8"));
  manifest.forEach(function (item) {
    const sourcePath = path.join(SEED_GALLERY_DIR, item.file);
    if (!fs.existsSync(sourcePath)) {
      return;
    }

    const uploadPath = path.join(UPLOADS_DIR, item.file);
    if (!fs.existsSync(uploadPath)) {
      fs.copyFileSync(sourcePath, uploadPath);
    }

    if (
      db.photos.some(function (photo) {
        return photo.filename === item.file;
      })
    ) {
      return;
    }

    const record = {
      id: nextId(db.photos),
      filename: item.file,
      title: item.title,
      placement: "gallery",
      sort_order: item.sort_order ?? 0,
      visible: true,
      created_at: new Date().toISOString(),
    };
    if (item.source_name) {
      record.source_name = item.source_name;
    }
    db.photos.push(record);
  });
}

function seedAdmin(db) {
  if (db.admin_users.length > 0) {
    return null;
  }

  const email = process.env.ADMIN_EMAIL || "cottonelder.construction@gmail.com";
  const password = process.env.ADMIN_PASSWORD || "CottonElderConstruction2026!";
  const hash = bcrypt.hashSync(password, 10);

  db.admin_users.push({
    id: 1,
    email,
    password_hash: hash,
    created_at: new Date().toISOString(),
  });

  return { email, password: process.env.ADMIN_PASSWORD ? null : password };
}

function createStore(db) {
  return {
    getAdminByEmail(email) {
      return db.admin_users.find(function (user) {
        return user.email.toLowerCase() === String(email).toLowerCase();
      });
    },
    getAdminById(id) {
      return db.admin_users.find(function (user) {
        return user.id === Number(id);
      });
    },
    updateAdmin(id, updates) {
      const user = this.getAdminById(id);
      if (!user) {
        return null;
      }
      Object.assign(user, updates);
      writeDb(db);
      return user;
    },
    listPhotos() {
      return db.photos
        .slice()
        .sort(function (a, b) {
          return (
            a.placement.localeCompare(b.placement) ||
            a.sort_order - b.sort_order ||
            a.id - b.id
          );
        });
    },
    getPhoto(id) {
      return db.photos.find(function (photo) {
        return photo.id === Number(id);
      });
    },
    addPhoto(photo) {
      const record = {
        id: nextId(db.photos),
        visible: true,
        created_at: new Date().toISOString(),
        ...photo,
      };
      db.photos.push(record);
      writeDb(db);
      return record;
    },
    updatePhoto(id, updates) {
      const photo = this.getPhoto(id);
      if (!photo) {
        return null;
      }
      Object.assign(photo, updates);
      writeDb(db);
      return photo;
    },
    clearHeroPlacement(exceptId) {
      db.photos.forEach(function (photo) {
        if (photo.placement === "hero" && photo.id !== exceptId) {
          photo.placement = "gallery";
        }
      });
      writeDb(db);
    },
    clearProjectSlot(slotIndex, exceptId) {
      db.photos.forEach(function (photo) {
        if (
          photo.placement === "project" &&
          photo.sort_order === slotIndex &&
          photo.id !== exceptId
        ) {
          photo.placement = "gallery";
        }
      });
      writeDb(db);
    },
    assignPhotoSlot(id, slot) {
      const photo = this.getPhoto(id);
      if (!photo) {
        return null;
      }

      if (slot === "hero") {
        this.clearHeroPlacement(photo.id);
        return this.updatePhoto(photo.id, { placement: "hero", sort_order: 0 });
      }

      const featuredMatch = /^featured-([1-3])$/.exec(slot);
      if (featuredMatch) {
        const slotIndex = Number(featuredMatch[1]) - 1;
        this.clearProjectSlot(slotIndex, photo.id);
        return this.updatePhoto(photo.id, { placement: "project", sort_order: slotIndex });
      }

      if (slot === "gallery") {
        return this.updatePhoto(photo.id, { placement: "gallery", sort_order: photo.sort_order || 0 });
      }

      return null;
    },
    photoSlot(photo) {
      if (!photo) {
        return null;
      }
      if (photo.placement === "hero") {
        return "hero";
      }
      if (photo.placement === "project" && photo.sort_order >= 0 && photo.sort_order <= 2) {
        return `featured-${photo.sort_order + 1}`;
      }
      return "gallery";
    },
    deletePhoto(id) {
      const index = db.photos.findIndex(function (photo) {
        return photo.id === Number(id);
      });
      if (index === -1) {
        return null;
      }
      const [removed] = db.photos.splice(index, 1);
      writeDb(db);
      return removed;
    },
    addSubmission(submission) {
      const record = {
        id: nextId(db.submissions),
        status: "new",
        created_at: new Date().toISOString(),
        ...submission,
      };
      db.submissions.push(record);
      writeDb(db);
      return record;
    },
    listSubmissions() {
      return db.submissions
        .slice()
        .sort(function (a, b) {
          return new Date(b.created_at) - new Date(a.created_at);
        });
    },
    getSubmission(id) {
      return db.submissions.find(function (submission) {
        return submission.id === Number(id);
      });
    },
    updateSubmission(id, updates) {
      const submission = this.getSubmission(id);
      if (!submission) {
        return null;
      }
      Object.assign(submission, updates);
      writeDb(db);
      return submission;
    },
  };
}

function initDatabase() {
  const db = readDb();
  seedPhotos(db);
  seedGalleryPhotos(db);
  const seededAdmin = seedAdmin(db);
  writeDb(db);
  return { store: createStore(db), seededAdmin };
}

function getPublicContent(store) {
  const photos = store.listPhotos().filter(function (photo) {
    return photo.visible;
  });

  return {
    hero: photos.find(function (photo) {
      return photo.placement === "hero";
    }) || null,
    projects: photos.filter(function (photo) {
      return photo.placement === "project";
    }),
    gallery: photos.filter(function (photo) {
      return photo.placement === "gallery";
    }),
  };
}

module.exports = {
  DATA_DIR,
  DB_PATH,
  UPLOADS_DIR,
  initDatabase,
  getPublicContent,
};
