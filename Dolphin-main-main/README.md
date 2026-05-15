# Shipzilla Main

This repository brings the Shipzilla platform together in one monorepo: landing page, seller client, admin dashboard, and backend API.

## Repository Layout

- `apps/landing` - Shipzilla marketing site imported from `https://github.com/mitalilily/shipzilla-landingpage`
- `apps/client` - Shipzilla seller/client dashboard
- `apps/admin` - Shipzilla admin dashboard
- `apps/backend` - Shipzilla API, jobs, courier integrations, webhooks, and database services

## Run Locally

- Admin: `cd apps/admin && npm install --legacy-peer-deps && npm start`
- Client: `cd apps/client && npm install && npm run dev`
- Landing: `cd apps/landing && npm install && npm run dev`
- Backend: `cd apps/backend && npm install && npm run dev`

## GitHub Actions VPS Deploy

The root workflow `.github/workflows/deploy-vps.yml` deploys to the VPS on every push to `main`. It packages the `Dolphin-main-main` app directory, uploads it to `/var/www/shipzilla/source`, and runs `deploy/vps-deploy.sh`.

Required repository secrets:

- `VPS_PASSWORD` or `VPS_SSH_KEY` - SSH authentication for the VPS.

Optional repository secrets or variables:

- `VPS_HOST` - VPS hostname or IP address, defaults to `72.60.96.97`.
- `VPS_USER` - SSH user, defaults to `root`.
- `VPS_PORT` - SSH port, defaults to `22`.

## Reconnect Deployments To This Repo

Keep the same environment variables and secrets. Only update the connected repository and app directory after you have verified the first deployment.

- Netlify admin: select `apps/admin` in monorepo setup. Build command `npm run build:netlify`, publish directory `build`, Node `20`, `NPM_FLAGS=--legacy-peer-deps`.
- Netlify client: select `apps/client` in monorepo setup. Build command `npm run build:netlify`, publish directory `dist`, Node `20`.
- Netlify landing: select `apps/landing` in monorepo setup. Build command `npm run build`, publish directory `dist`.
- Vercel client: set the Root Directory to `apps/client`.
- Render backend: set the Root Directory to `apps/backend`, or deploy with the root `render.yaml` in this repository.

Do not delete the old repositories until each hosted app has been reconnected to this repo, redeployed, and checked in production.
