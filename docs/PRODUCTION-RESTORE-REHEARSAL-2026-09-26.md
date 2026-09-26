# Production restore rehearsal — 2026-09-26

## Result

The first full disaster-recovery rehearsal completed successfully on 2026-09-26 at approximately 12:39 UTC. It restored an actual scheduled production backup into disposable PostgreSQL 16 infrastructure without stopping or modifying production.

Restore source:

`s3://personalhub-production-210855481769-pg-backups/postgresql/scheduled/personalhub-20260926T122629949653Z.dump`

Verified backup properties:

- custom-format PostgreSQL archive;
- size: 25,513 bytes;
- SHA-256: `4eedc178f8aa483241a387bf7edafdc9c4a08a8f302ae2a87a4aa8970e223ce4`;
- S3 native SHA-256 checksum matched;
- S3 `sha256` object metadata matched;
- S3-managed encryption: AES256;
- archive table of contents readable with `pg_restore --list`.

## Disposable architecture

The rehearsal downloaded the backup from S3 through the EC2 instance role into the protected backup workspace. It then created:

- a uniquely named internal Docker network with no external connectivity;
- a uniquely named disposable Docker volume;
- a PostgreSQL 16 container using the same pinned image as production;
- no host port mappings;
- no connection to the production PostgreSQL network or volume.

The archive was restored with `pg_restore --single-transaction --exit-on-error --no-owner --no-privileges`. The production database, containers, and `personalhub-production-postgres-data` volume were observational only.

## Validation

Every application table matched the live pre-rehearsal baseline by count and deterministic complete-row fingerprint:

| Table                | Production | Restored | Result |
| -------------------- | ---------: | -------: | ------ |
| `Project`            |          5 |        5 | PASS   |
| `Task`               |          6 |        6 | PASS   |
| `Assignment`         |          1 |        1 | PASS   |
| `Note`               |          0 |        0 | PASS   |
| `Tag`                |          4 |        4 | PASS   |
| `_AssignmentTags`    |          1 |        1 | PASS   |
| `_NoteTags`          |          0 |        0 | PASS   |
| `_TaskTags`          |          6 |        6 | PASS   |
| `Owner`              |          1 |        1 | PASS   |
| `Session`            |          2 |        2 | PASS   |
| `ApiToken`           |          0 |        0 | PASS   |
| `LoginThrottle`      |          0 |        0 | PASS   |
| `_prisma_migrations` |          2 |        2 | PASS   |

Foreign-key orphan checks passed for projects, tasks, notes, assignments, tags, and all implicit join tables. The immutable production PersonalHub image ran Prisma Client against only the restored database and read the expected project, task, assignment, note, tag, and owner counts. Owner-initialized state was recognized from the restored row count. No production owner password or authentication credential was used.

A disposable application server and interactive login were not required for acceptance; the approved database-level checks plus Prisma Client validation exercised the recovery boundary without exposing a host port or real credential.

## Cleanup and production safety

After validation, the disposable PostgreSQL container, network, volume, downloaded dump, and temporary runtime configuration were removed. No rehearsal resources remained. The production volume name, creation timestamp, and mountpoint were unchanged.

Post-rehearsal checks confirmed:

- PersonalHub, PostgreSQL, and cloudflared healthy;
- internal and public health available;
- production row counts unchanged;
- owner and migration counts unchanged;
- no application or database host ports;
- zero AWS security-group ingress;
- SSM online and SSH masked.

The scheduled S3 backup and the separate manual pre-local-data-migration backup remain intact. No production restore was performed.
