# Shipzilla Render deployment

Use these values in Render. Do not add the PostgreSQL URL to the client or admin services.

## Backend: `shipzilla-backend`

Service type: Web Service

Root directory if your Render service is connected to the repository root:

```bash
Dolphin-main-main/apps/backend
```

If your Render service is already pointed inside `Dolphin-main-main`, use:

```bash
apps/backend
```

Build command:

```bash
npm install --include=dev && npm run build
```

Do not use `npm run start` as the build command. `start` is only for the runtime phase after `dist/index.js` has been created.

Start command:

```bash
npm start
```

Environment:

```bash
NODE_ENV=production
API_URL=https://shipzilla-backend.onrender.com
FRONTEND_URL=https://shipzilla-main.onrender.com
CORS_ORIGINS=https://shipzilla-main.onrender.com,https://shipzilla-admin.onrender.com
PGSSLMODE=require
DATABASE_URL=<paste the Render PostgreSQL URL>

ACCESS_TOKEN_SECRET=<generate a long random secret>
REFRESH_TOKEN_SECRET=<generate a different long random secret>
COURIER_SECRET_KEY=<generate a different long random secret>

EMAIL_FROM=shipzilla05@gmail.com
GOOGLE_SMTP_USER=shipzilla05@gmail.com
GOOGLE_SMTP_PASSWORD=<gmail app password or smtp password>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false

EXPOSE_AUTH_CODES=false
ALLOW_INLINE_OTP=false
```

For temporary login testing without SMTP, set `EXPOSE_AUTH_CODES=true`. Turn it back to `false` before real production use.

## Client: `shipzilla-main`

Service type: Static Site

Root directory if your Render service is connected to the repository root:

```bash
Dolphin-main-main/apps/client
```

If your Render service is already pointed inside `Dolphin-main-main`, use:

```bash
apps/client
```

Build command:

```bash
npm install && npm run build
```

Publish directory:

```bash
dist
```

If Render is currently serving `/src/main.tsx`, the publish directory is wrong. Set it to `dist`, or keep the build command above and redeploy after this commit; the Render-only postbuild also copies `dist` to the app root as a fallback.

Rewrite rule:

```text
/*  /index.html  200
```

Environment:

```bash
VITE_API_URL=https://shipzilla-backend.onrender.com/api
VITE_APP_SOCKET_URL=https://shipzilla-backend.onrender.com
VITE_UI_ONLY_AUTH=false
VITE_GOOGLE_OAUTH_CLIENT_ID=<optional google oauth client id>
VITE_PUBLIC_GEOAPIFY_KEY=<optional geoapify key>
```

`VITE_UI_ONLY_AUTH=false` is the important switch that makes the client login call the backend instead of the local demo login.

## Admin: `shipzilla-admin`

Service type: Static Site

Root directory if your Render service is connected to the repository root:

```bash
Dolphin-main-main/apps/admin
```

If your Render service is already pointed inside `Dolphin-main-main`, use:

```bash
apps/admin
```

Build command:

```bash
npm install --legacy-peer-deps && npm run build:netlify
```

Publish directory:

```bash
build
```

If Render returns 404 at `/`, the publish directory is wrong. Set it to `build`, or redeploy after this commit; the Render-only postbuild also copies `build` to the app root as a fallback.

Rewrite rule:

```text
/*  /index.html  200
```

Environment:

```bash
REACT_APP_API_BASE_URL=https://shipzilla-backend.onrender.com/api
REACT_APP_SOCKET_URL=https://shipzilla-backend.onrender.com
```

## Landing: `shipzilla-landing`

Service type: Static Site

Root directory if your Render service is connected to the repository root:

```bash
Dolphin-main-main/apps/landing
```

If your Render service is already pointed inside `Dolphin-main-main`, use:

```bash
apps/landing
```

Build command:

```bash
npm install && npm run build
```

Publish directory:

```bash
dist
```

Rewrite rule:

```text
/*  /index.html  200
```
