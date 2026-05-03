# Nifty 50 Tracker — Setup Guide

## Prerequisites
- Node.js ≥ 18 (download from https://nodejs.org)
- Git
- A Dhan trading account (https://dhan.co) for live data
- A Firebase project for push notifications

---

## 1 — Run the PWA locally

```bash
# Inside the project folder:
npm install
npm run dev
# Opens at http://localhost:5173
```

To build for production:
```bash
npm run build
# Output in /dist — deploy to GitHub Pages, Netlify, Vercel, etc.
```

---

## 2 — Generate PWA Icons

1. Open `public/generate-icons.html` in any browser
2. Right-click the **192×192** canvas → **Save image as** → `public/icons/icon-192.png`
3. Right-click the **512×512** canvas → **Save image as** → `public/icons/icon-512.png`

---

## 3 — Deploy to GitHub Pages

```bash
# In vite.config.js, set base to your repo name if not using custom domain:
#   base: '/your-repo-name/'

npm run build
git add dist -f
git commit -m "deploy"
git subtree push --prefix dist origin gh-pages
```

Or use the **GitHub Actions** deploy workflow (add your own `.github/workflows/deploy.yml`).

---

## 4 — Configure GitHub Secrets

Go to your repo → **Settings → Secrets → Actions** and add:

| Secret              | Value                                     |
|---------------------|-------------------------------------------|
| `DHAN_CLIENT_ID`    | Your Dhan client ID                       |
| `DHAN_ACCESS_TOKEN` | Dhan API Bearer token (renew daily)       |
| `FCM_SERVER_KEY`    | Firebase Cloud Messaging server key       |
| `FCM_DEVICE_TOKEN`  | Your Android/iOS FCM registration token   |
| `NIFTY_LEVELS`      | Comma-separated levels e.g. `24200,24800` |
| `BANK_NIFTY_LEVELS` | Comma-separated levels e.g. `52000,53500` |

---

## 5 — Firebase FCM Setup

1. Go to https://console.firebase.google.com → Create project
2. Project Settings → Cloud Messaging → copy **Server Key**
3. Add the Firebase SDK to your PWA (optional — for auto-token refresh):
   ```bash
   npm install firebase
   ```
4. In the PWA Settings tab, the device token is auto-registered when you grant notification permission

---

## 6 — Dhan Access Token

Dhan access tokens expire daily. Options to automate renewal:
- Use the Dhan web portal to generate a new token each morning
- Or set up a separate GitHub Action that calls Dhan's login API and updates the secret

---

## 7 — Strategy Parameters (edit in `strategy/nifty_strategy.py`)

| Parameter          | Default | Description                          |
|--------------------|---------|--------------------------------------|
| `EMA_FAST`         | 9       | Fast EMA period                      |
| `EMA_SLOW`         | 15      | Slow EMA period                      |
| `MIN_ANGLE_DEG`    | 30      | Minimum EMA slope angle (degrees)    |
| `LEVEL_CONFLUENCE` | 50      | Max distance from key level (points) |
| `BODY_RATIO`       | 0.6     | Marubozu body-to-range ratio         |
| `CANDLES_NEEDED`   | 40      | Candles to fetch per run             |
