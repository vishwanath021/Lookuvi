# CERT-In Directions (April 2022) — Lookuvi ops note

This is an **operations checklist**, not legal advice.

## Entity contacts

| Field | Value |
|---|---|
| Legal name | Agentic Build Works |
| Registered / postal address | 4-164/140, Om Nagar Colony, Kismatpur, Hyderabad 500030, Telangana, India |
| CERT-In report contact | Geddam Swami Veerendra · admin@agenticbuildworks.com |
| Hosting | Hostinger VPS, India region (confirm city/DC on the invoice) |
| TRAI DLT | N/A — Lookuvi does not send commercial SMS today |
| CIN / GSTIN | Not issued yet — omit from customer UI until set via `COMPANY_CIN` / `COMPANY_GSTIN` |

## Log retention (180 days)

| Stream | Where | Retention target |
|---|---|---|
| Application stdout/stderr (Next.js) | Docker `json-file` on the Hostinger VPS (India) | **≥ 180 days** (rotate size, keep enough files or ship to a log store in India) |
| Reverse proxy (Caddy) access/error | Host / container logs | **≥ 180 days** |
| Postgres / Redis | Backups + slow-query if enabled | Align with policy; DB backups are not a substitute for security logs |
| AuditLog rows (admin / security incidents) | Postgres in India | Retain ≥ 180 days; purge job must not delete incident rows early |

Docker Compose production services set `logging` options (`max-size` / `max-file`) so a single disk fill does not wipe history. **Operators must still ship or archive rotated files** so the rolling window covers 180 days (disk on a small VPS is not enough by itself). Preferred: ship to an India-region object store or SIEM and retain 180 days there.

## NTP

All production hosts must sync time with NTP (e.g. `chrony` or `systemd-timesyncd`) to Indian or well-known stratum sources. Skew breaks log correlation and certificate validity. Verify with `timedatectl` after provisioning.

## Incident reporting (6 hours)

On becoming aware of a reportable cyber incident (as defined in CERT-In directions / FAQs), the on-call founder:

1. Records the incident with `logSecurityIncident` / Admin audit (action `SECURITY_INCIDENT`) — time (IST), systems, IOCs known, containment status.
2. Contains and preserves evidence (do not wipe disks hastily).
3. Reports to CERT-In within **6 hours** via the prescribed channel, using the entity contacts above.
4. Follows up with a detailed report as required.

## Related code

- App logger: `src/lib/logger.ts` (redacts photos, keys, phones)
- Incident helper: `src/lib/security-incident.ts`
- Legal defaults: `src/lib/legal.ts`
- Retention of guest preview objects (24h) is separate from CERT-In log retention — see `src/lib/retention.ts`
