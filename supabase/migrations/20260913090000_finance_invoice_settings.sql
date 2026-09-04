-- Source: Gokul, direct request 2026-09-03 — Finance page overhaul, item
-- 9.1 ("Send invoices directly through Autopilot" toggle + a custom
-- message shown alongside bank details when it's on).

alter table organisations
  add column invoice_send_via_app boolean not null default true,
  add column invoice_custom_message text null;
