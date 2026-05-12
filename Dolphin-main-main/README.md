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

## Reconnect Deployments To This Repo

Keep the same environment variables and secrets. Only update the connected repository and app directory after you have verified the first deployment.

- Netlify admin: select `apps/admin` in monorepo setup. Build command `npm run build:netlify`, publish directory `build`, Node `20`, `NPM_FLAGS=--legacy-peer-deps`.
- Netlify client: select `apps/client` in monorepo setup. Build command `npm run build:netlify`, publish directory `dist`, Node `20`.
- Netlify landing: select `apps/landing` in monorepo setup. Build command `npm run build`, publish directory `dist`.
- Vercel client: set the Root Directory to `apps/client`.
- Render backend: set the Root Directory to `apps/backend`, or deploy with the root `render.yaml` in this repository.

Do not delete the old repositories until each hosted app has been reconnected to this repo, redeployed, and checked in production.
