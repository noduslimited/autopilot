// Source: Gokul, direct request 2026-09-03 — the NOK messaging toggle
// (and Settings → Notifications' toggles, built separately in Session 12)
// had inconsistent/incorrect on-off styling. One shared component now,
// so every toggle switch in the app looks and behaves identically:
// OFF = light grey bar, white circle. ON = NHS Green (#007F3B) bar, white
// circle — only the bar changes colour, per the explicit instruction.
export interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
        checked ? "bg-nhs-green" : "bg-border-default",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}
