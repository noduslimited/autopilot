// Source: Information Architecture Document section 8 (Settings
// Sub-navigation) — 4 groups, 8 routes, matching PRD section 4.10's left
// nav exactly. Shared between the desktop SettingsNav sidebar and the
// mobile SettingsIndexClient stacked category list so the two can't
// drift out of sync.
export const SETTINGS_GROUPS = [
  {
    label: "Organisation",
    items: [
      { href: "/settings/organisation", label: "Profile" },
      { href: "/settings/branding", label: "Branding" },
      { href: "/settings/care-types", label: "Care types" },
    ],
  },
  {
    label: "Users & access",
    items: [
      { href: "/settings/team", label: "Team members" },
      { href: "/settings/permissions", label: "Roles & permissions" },
    ],
  },
  {
    label: "Billing",
    items: [
      { href: "/settings/billing", label: "Plan & usage" },
      { href: "/settings/invoicing", label: "Invoicing defaults" },
    ],
  },
  {
    label: "Integrations",
    items: [{ href: "/settings/notifications", label: "Notifications" }],
  },
];
