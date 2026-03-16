# Backup And Recovery

This runbook covers backup discipline and emergency recovery for MontyClub.

## Baseline Requirements

1. Enable Supabase backups and point-in-time recovery.
2. Restrict access to `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_API_KEY`.
3. Keep destructive actions disabled in production unless explicitly needed.

## Backup Commands

Create backup:

```bash
npm run backup:export
```

Verify latest backup:

```bash
npm run backup:verify
```

Verify a specific file:

```bash
npm run backup:verify -- backups/montyclub-backup-YYYYMMDD-HHMMSSZ.json
```

## Recommended Schedule

- Nightly backup.
- Backup immediately before major imports or data cleanup operations.
- Retention policy:
- Daily backups for 30 days.
- Weekly backups for 12 weeks.
- Monthly backups for 12 months.

## Minimum Recovery Drill

Run at least monthly:

1. Restore one recent backup into staging.
2. Validate collection and registration counts.
3. Verify catalog pages and admin login.
4. Document drill date and results.

## Incident Procedure

If data appears missing or corrupted:

1. Stop destructive operations.
2. Export current state backup immediately.
3. Compare with latest known-good backup.
4. Restore to staging first and validate.
5. Restore production only after staging verification.
6. Record root cause and preventive fix.

## Safety Rules

1. Never run factory reset or broad clear-data operations without a same-day backup.
2. Keep at least one copy of backups off-platform.
3. Validate backups regularly; unverified backups are not reliable.
