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
          // left-0 (not just a translate-x offset) anchors the circle to
          // the track's own left edge explicitly — without it, an
          // absolutely-positioned element with no left/right set falls
          // back to its "static position" (where it would have sat in
          // normal flow), which is undefined here and rendered
          // differently across browsers, pushing the circle out past the
          // track entirely on a real device. transition-transform then
          // only ever needs to describe the slide distance, not the base
          // position too.
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
          checked ? "translate-x-[20px]" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}
