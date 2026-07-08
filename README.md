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

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/RhiBee003/cotton-elder-construction)

One-click deploy (free tier). When prompted, set `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

After deploy, your site will be at `https://cotton-elder-construction.onrender.com`.

## Customize

- Manage photos and inquiries in the admin panel
- Update contact details in `index.html`
