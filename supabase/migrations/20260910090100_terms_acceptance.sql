-- Source: Security and Data Privacy Document section 2.3 — "The DPA is
-- incorporated into Autopilot's Terms of Service, which every
-- organisation must accept during registration. Acceptance is recorded
-- with a timestamp and IP address." Never built in any prior session
-- (the registration form only ever linked to /terms) — closed as part
-- of Session 14's /terms and /privacy page work.
alter table organisations
  add column terms_accepted_at timestamptz,
  add column terms_accepted_ip text;
