# Cotton Elder Construction

Modern marketing site for **Cotton Elder Construction** — dark mode, responsive layout, project gallery, and admin panel.

## Stack

- HTML, CSS, and JavaScript frontend
- Node.js + Express admin API
- JSON file storage for photos and contact requests

## Local preview

```bash
cd cotton-elder-construction
npm install
npm start
```

Open [http://localhost:8080](http://localhost:8080).

The private admin URL is printed in the terminal when the server starts. Set `ADMIN_ACCESS_KEY` in `.env` to choose your own secret path.

Copy `.env.example` to `.env` to customize the admin account, access key, and session secret.

## Deploy on Render

This repo includes a [`render.yaml`](render.yaml) blueprint for one-click deploy.

### Option A — Blueprint (recommended)

1. Push this repo to GitHub.
2. In [Render](https://render.com), click **New → Blueprint**.
3. Connect the `cotton-elder-construction` repository.
4. When prompted, set:
   - `ADMIN_EMAIL` — admin sign-in email
   - `ADMIN_PASSWORD` — admin sign-in password (8+ characters)
5. Click **Apply**. Render creates the web service with a **1 GB persistent disk** so photos and contact submissions survive redeploys.

After deploy:

- Public site: `https://your-service.onrender.com`
- Admin panel: `https://your-service.onrender.com/YOUR_ADMIN_ACCESS_KEY`  
  Find `ADMIN_ACCESS_KEY` in the service **Environment** tab (auto-generated unless you set one).

### Option B — Manual web service

1. **New → Web Service** → connect this repo.
2. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Health check path:** `/health`
3. Add a **Persistent Disk** (1 GB) mounted at `/var/data`.
4. Environment variables:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `STORAGE_PATH` | `/var/data` |
| `SESSION_SECRET` | long random string |
| `ADMIN_ACCESS_KEY` | secret URL path for admin |
| `ADMIN_EMAIL` | your admin email |
| `ADMIN_PASSWORD` | your admin password |

### Notes for production

- `data/` and `uploads/` must live on the persistent disk (`STORAGE_PATH=/var/data`) or they reset on each deploy.
- HEIC upload conversion uses macOS `sips` locally; on Render use JPEG or PNG.
- Seed photos in `images/` are copied into storage on first run if the database is empty.

## Customize

- Manage photos and inquiries in the admin panel
- Update contact details in `index.html`
