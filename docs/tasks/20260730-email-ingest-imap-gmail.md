# Task: Email ingest IMAP/Gmail to ERP DB

## Date

- 2026-07-30

## Scope

- Add backend capability to read emails from IMAP (including Gmail IMAP), persist normalized email payload to ERP database, and store attachments through existing R2 + sys_files flow.
- Support two IMAP auth modes: `PASSWORD` and `OAUTH2`.

## Checklist

- [x] Create entities for messages and attachments
- [x] Create ingest service using IMAP + mail parser
- [x] Support both password and OAuth2 IMAP auth modes
- [x] Persist message body/headers/links as JSON-friendly payload
- [x] Persist attachments to R2 and `sys_files`
- [x] Add secured API endpoint for manual sync
- [x] Register module in app
- [x] Add env config template
- [x] Add migration for new tables
- [ ] Run migration on target database
- [ ] Add RBAC resource entry if endpoint must be permission-gated
- [ ] Add scheduler/cron for automatic polling

## Notes

- Reading inbound mail uses IMAP, not SMTP. SMTP is for sending.
- Gmail/Workspace support can use either app password or OAuth2 refresh token flow.
