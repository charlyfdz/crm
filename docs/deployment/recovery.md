# Backup, restore, and rollback

These procedures prepare future authorized operations. Do not execute them on the homelab during this task.

## Boundaries

Use only an approved installation-owned backup location. Never use `HOMELAB_BACKUP1TB`.
That disk remains rejected, unmounted, and read-only. This task does not mount, inspect, purchase, or replace a disk.
The NVMe and HOMELAB_DATA contingency copies share one host and site. They are not offsite protection.
Record that remaining failure domain in the pilot acceptance decision.

Record RPO, RTO, retention, encryption, operator ownership, and storage admission before production.
This package implements manual database operations. It does not install a backup scheduler.
No command deletes databases, volumes, archives, or restored test data.
The operator retains failed restores and partial archives for investigation.

## Backup contract

Stop every application writer before backup: application, API, cron, agent, provisioning, and migration jobs.
Keep PostgreSQL running. Redis contains disposable cache state.
The script checks Compose services before it proceeds. Review outside writers separately.

The backup uses PostgreSQL custom format, without object owners or ACLs.
It creates a new archive through an exclusive `.partial` file and refuses existing output files.
The manifest records SHA-256, table counts, installation name, release identifier, and image information.
It contains no credentials or record contents. Keep the archive private; its data remains sensitive.
POSIX file creation requests mode `0600`. Windows needs separately verified NTFS access controls.
The script does not encrypt the archive. Use an accepted encrypted storage and transfer procedure.

The default command creates a plan only:

```text
node --env-file=.env deploy/scripts/operations.mjs backup <approved-new-archive-path>
```

The operator adds `--execute` only after separate authorization, quiescence, and storage acceptance.
The script does not stop services itself. It does not run Docker in plan mode.

## Restore drill

Restore only trusted archives from the same installation.
Database restoration executes archive SQL with database-owner privileges. A checksum does not establish archive trust.
Use the exact source release and its verified migration image before restoration.

```text
node --env-file=.env deploy/scripts/operations.mjs restore-drill <approved-archive-path>
node --env-file=.env deploy/scripts/operations.mjs restore-new <approved-archive-path> <new-database-name>
```

Both commands create plans until the operator adds `--execute` after separate authorization.
The drill generates a new `_test` database name. `restore-new` requires a new, safe, non-system database name.
The source database remains unchanged. Existing target databases make `createdb` fail; the script never drops them.

Restore validation runs in this order:

1. Verify application quiescence.
2. Verify manifest format, installation, source release, and archive checksum.
3. Create a new empty database from `template0`.
4. Restore the archive with one transaction and exit-on-error.
5. Compare table counts with the manifest.
6. Run Prisma schema diff against the exact source release.
7. Reapply application grants without running new migrations.
8. Write a verification receipt with application smoke acceptance still pending.

PostgreSQL documents the transaction behavior in [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
Prisma grants protect `_prisma_migrations` from application writes and remove public database and schema privileges.
Schema checks and table counts do not prove account login, role enforcement, or record correctness.

Create an isolated application test against the restored database after separate authorization.
Test operator login, owners and members, key records, relationships, pipelines, settings, and attachments.
Disable outbound integrations, telemetry, and AI during the restore drill.
Measure restore time. Record business smoke results without exposing business data.
Do not promote a restored database before these results receive acceptance.

## Complete recovery scope

The database dump excludes the following resources:

- Runtime secrets and password-manager recovery material.
- External Blob objects, attachments, logos, and photos.
- Future local upload volumes and encryption keys.
- Private DNS, TLS, proxy, tailnet policy, and Coolify configuration.
- Approved source releases and frozen container images stored outside the database.

Accept a separate recovery contract for each active resource before installation.
Redis does not need business-data backup because this package uses it only as a disposable cache.
Never change Redis to business persistence without changing this recovery contract.

## Rollback

Record the previous source release, exact image digests, schema version, configuration, and accepted backup before any upgrade.
Rollback images only after proving schema compatibility with the previous application.
An incompatible schema requires restoration into a new database with the previous release.
The script applies no down migrations and runs no `db push`, reset, or seed.

For a recovery rollback, keep writers stopped and retain the failed database.
Restore the accepted backup into a new database using the previous release.
Reapply application grants, validate login and business flows, and obtain switch approval.
Change the installation database target only after acceptance. Never overwrite the failed database as a shortcut.
Rebuild the application after origin changes. Record every acceptance and rollback decision in the service lifecycle record.

Coolify rewrites deployment mappings. These commands target the repository Compose definition.
Verify project names, networks, image tags, and volumes against the actual generated definition before operating a Coolify installation.
Never assume that a local Compose command targets an existing Coolify resource correctly.

## Issues

1. NOT DONE — Real backup, restore, grant enforcement, and application smoke tests remain unexecuted.
   Fix: run the complete recovery drill in an authorized Docker environment before release acceptance.
2. NOT DONE — Automatic backup scheduling, retention, encrypted transfer, and file-storage recovery remain incomplete.
   Fix: implement accepted RPO, RTO, retention, encryption, and storage recovery before operational guarantees.
3. RISK — Same-host contingency copies do not survive complete host or site loss.
   Fix: record the accepted risk and plan an authorized offsite copy. Do not use the rejected disk.
