// Source: PRD section 5.2 ("Get directions" button behaviour) — opens the
// device's default maps app immediately, no confirmation dialog.
export function getDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}
