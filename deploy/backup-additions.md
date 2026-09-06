# Backup additions for arcing

The arcs are files, not rows, so the nightly Postgres dump does not cover them.
Three lines go into the box's existing backup script.

Confirmed this session: the script is `/usr/local/bin/pg-backup.sh`, run by
`pg-backup.timer` (`OnCalendar=03:30`, `Persistent=true`). It dumps every
database, sweeps old dumps with `find /var/backups/pg -name "*.sql.gz" -mtime
+14 -delete`, then, behind an `rclone listremotes | grep gdrive-personal`
guard, copies to the `gdrive-personal:pg` remote with `--include "suke-*"
--include "carnet-*" --include "banso-*"`, and copies the rest to
`gdrive-forged:box-backups/pg`.

Read the real script before editing it. Never rewrite it.

    ssh -i ~/.ssh/vultr_box root@155.138.231.13 "cat /usr/local/bin/pg-backup.sh"

1. Beside the pg_dump lines, add a tarball of the arc data:

       tar czf "/var/backups/pg/arcing-data-$(date +%F).tar.gz" -C /srv/deploy/arcing data

2. In the retention sweep: the existing `find` matches only `*.sql.gz`, so the
   tarball needs its own line rather than falling under that pattern, same
   14-day window:

       find /var/backups/pg -name "arcing-data-*.tar.gz" -mtime +14 -delete

3. In the `gdrive-personal` include filter, add the tarball alongside suke,
   carnet and banso so it reaches offsite storage:

       --include "arcing-data-*"

Verify the night after: the tarball exists in `/var/backups/pg`, and it exists
in the `gdrive-personal:pg` remote folder.
