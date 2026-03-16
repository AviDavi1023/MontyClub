# MontyClub Operations Guide

This runbook is for hosting admins managing production.

## Core Model

- Registration collections and club registrations are managed in Postgres.
- Public catalog data is served from a published snapshot.
- Announcements, updates, and selected settings are handled in runtime storage.

## Daily Checklist

1. Confirm the active registration collection is correct.
2. Review pending registrations in `/admin`.
3. Approve or deny submissions.
4. Publish the catalog after approval changes.
5. Spot-check public catalog pages.

## Weekly Checklist

1. Run backup export.
2. Run backup verification.
3. Review Vercel logs for recurring warnings or errors.
4. Audit admin user access.

## Safe Publish Workflow

1. Complete approval and denial actions.
2. Run publish from the admin dashboard.
3. Confirm snapshot status is updated.
4. Validate homepage and a few random club detail pages.

## Troubleshooting

### Registrations are not showing in public catalog

1. Verify registrations are approved.
2. Verify the correct display collection is selected.
3. Publish catalog again.
4. Check Vercel function logs for publish errors.

### Admin actions return unauthorized

1. Verify `ADMIN_API_KEY` in environment variables.
2. Verify the key entered in the dashboard is current.
3. Retry with a fresh admin session.

### Renewal page has no clubs

1. Verify `renewalEnabled` is turned on for the target collection.
2. Verify renewal source collections are configured.
3. Verify approved registrations exist in source collections.

## Logging Policy

- Routine success noise is intentionally minimized.
- Warnings and errors are preserved for production diagnostics.
- Vercel logs are the source of truth for incident triage.

## Security Defaults

- Keep `ALLOW_DESTRUCTIVE_ADMIN_ACTIONS` disabled in production.
- Restrict access to `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_API_KEY`.
- Rotate admin credentials after staffing changes.
