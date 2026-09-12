# Railway deployment

Production backend configuration:

- Root directory: `/backend`
- Build command: `npm ci && npx prisma generate && npm run build`
- Pre-deploy command: `npx prisma migrate deploy`
- Start command: `npm run start`
- Runtime: Node 22.23.2
- Public port: `3000`

The PostgreSQL service must be available before deployment and `DATABASE_URL` must point to the production PostgreSQL database. Prisma migrations are applied during pre-deploy; do not replace this with `prisma migrate resolve` except as a one-time recovery step for a known failed migration.
