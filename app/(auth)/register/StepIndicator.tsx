interface StepIndicatorProps {
  currentStep: 1 | 2;
}

// 3-dot indicator per the Register mockup: completed step is a solid green
// circle, the active step is a solid blue circle with its number, upcoming
// steps are outlined grey circles with a muted number. Step 3 has no data
// entry of its own in this build (see CLAUDE.md Session 2 log) — it lights
// up only as the "done" state immediately before the post-registration
// redirect, so it never renders as "current" here.
export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [1, 2, 3] as const;

  return (
    <div className="flex items-center">
      {steps.map((step, index) => {
        const isComplete = step < currentStep;
        const isActive = step === currentStep;

        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label font-medium " +
                (isComplete
                  ? "bg-nhs-green text-white"
                  : isActive
                    ? "bg-nhs-blue text-white"
                    : "border border-border-default bg-card-bg text-text-muted")
              }
            >
              {step}
            </div>
            {index < steps.length - 1 ? (
              <div
                className={
                  "mx-2 h-px flex-1 " + (isComplete ? "bg-nhs-green" : "bg-border-default")
                }
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
