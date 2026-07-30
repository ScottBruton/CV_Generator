# Deploy CV Generator to Render + scottbruton.net

This app cannot run on GoDaddy **Websites + Marketing**. Keep the domain at GoDaddy; host the app on Render and point DNS there.

## 1. Put secrets in Render (not in git)

After the Web Service exists: **Render Dashboard → cv-generator → Environment**

| Key | Value |
|-----|--------|
| `AUTH_USERNAME` | your username |
| `AUTH_PASSWORD` | a **new** password (do not reuse one posted in chat) |
| `OPEN_AI_API_KEY` | same as local `.env` |
| `OPEN_AI_MODEL` | `gpt-5.6-sol` |
| `SESSION_SECRET` | long random string (Render can auto-generate) |

Optional local test (root `.env`, gitignored):

```env
AUTH_USERNAME=scottpierrebruton
AUTH_PASSWORD=your-new-password
SESSION_SECRET=any-long-random-string
```

## 2. Push deployable code to GitHub `main`

Repo: `https://github.com/ScottBruton/CV_Generator.git`

```bash
git checkout main
git merge AI
git push origin main
```

(Or open a PR from `AI` → `main` and merge.)

Render should track **branch `main`**.

## 3. Create the Render Web Service

1. Sign up / log in at [https://render.com](https://render.com)
2. **New → Blueprint** (uses `render.yaml`) **or** **New → Web Service**
3. Connect GitHub repo `ScottBruton/CV_Generator`
4. Branch: `main`
5. Build: `npm install && npx puppeteer browsers install chrome && npm run build`
6. Start: `npm run start:prod`
7. Add the env vars from section 1
8. Deploy

Confirm `https://<your-service>.onrender.com` shows the **login** page, then the app after sign-in.

## 4. Point scottbruton.net at Render

1. In Render: **Settings → Custom Domains** → add `scottbruton.net` (and `www` if you want)
2. Copy the DNS records Render shows (usually a CNAME or A record)
3. In GoDaddy: **DNS** for `scottbruton.net`
   - Remove / replace records that point at Website Builder
   - Add the Render records
4. Wait for DNS + SSL (can take minutes to hours)

Website Builder can remain in your GoDaddy account unused; the domain will serve Render.

## 5. Auto-updates from GitHub

Every push to `main` triggers a Render redeploy. Keep secrets only in Render Environment.

## Notes

- Free Render services may spin down when idle (first request can be slow)
- PDF export needs Chromium (installed in the build command via Puppeteer)
- Content JSON in the repo is the source of truth; disk on Render is ephemeral across deploys
