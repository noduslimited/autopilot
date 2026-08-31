-- User Stories AI-03/AI-04 describe "Save to care plan" and a separate
-- "Edit first" button, implying the AI-drafted update suggestion text
-- itself gets persisted somewhere on the care plan — but care_plans has
-- no free-text field to hold it (only structured care_needs/
-- what_we_help_with). Added now as the minimal necessary field to
-- implement that acceptance criteria, not a speculative addition.

alter table care_plans add column ai_suggested_updates text;
