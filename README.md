# MontyClub

MontyClub is the Carlmont High School club catalog and registration platform.

It provides:
- A public club directory for students.
- Club charter and renewal submission flows.
- An admin dashboard for approvals, collections, announcements, updates, and user management.

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Postgres + Storage)
- Optional Vercel KV cache

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Create `.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_API_KEY=...

# Optional
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
ALLOW_DESTRUCTIVE_ADMIN_ACTIONS=false
```

3. Start development server.

```bash
npm run dev
```

4. Open:
- Public catalog: `http://localhost:3000`
- Admin dashboard: `http://localhost:3000/admin`

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` required.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` required.
- `SUPABASE_SERVICE_ROLE_KEY` required for admin/server operations.
- `ADMIN_API_KEY` required for protected admin API routes.
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` optional cache layer.
- `ALLOW_DESTRUCTIVE_ADMIN_ACTIONS` defaults to safe behavior. Keep unset or `false` in production.

## Daily Admin Workflow

1. Sign in at `/admin`.
2. Confirm active registration collection is correct.
3. Review pending registrations and approve or deny.
4. Publish catalog after approval changes.
5. Spot-check public catalog entries.

## Excel Import

Use the admin Excel import tool for bulk loading registrations.

- Format details: `EXCEL_FORMAT.md`
- Backup before major imports: `BACKUP_AND_RECOVERY.md`

## Backup And Recovery

- Export backup: `npm run backup:export`
- Verify backup: `npm run backup:verify`
- Full runbook: `BACKUP_AND_RECOVERY.md`

## Production Notes

- Set all required environment variables in Vercel.
- Keep destructive actions disabled unless intentionally performing emergency cleanup.
- Use Vercel function logs to monitor server errors.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run backup:export`
- `npm run backup:verify`
