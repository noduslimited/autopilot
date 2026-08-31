// Login-screen logo variant per PRD section 3.1: "Autopilot" in #003087,
// "NODUS LIMITED" in #41B6E6 spaced caps below — rendered on a white card,
// not the dark sidebar background, so colours differ from the sidebar logo.
export function AuthLogo() {
  return (
    <div className="text-center">
      <div className="text-page-heading text-nhs-dark-blue">Autopilot</div>
      <div className="mt-0.5 text-[10px] font-normal uppercase tracking-[2px] text-nhs-light-blue">
        Nodus Limited
      </div>
    </div>
  );
}
