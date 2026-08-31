// Source: PRD section 4.3 ("Step indicator: 4 numbered steps shown at top
// — active step in #005EB8, completed in green, upcoming in grey")
const STEPS = [1, 2, 3, 4] as const;

export function StepIndicator({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-center">
      {STEPS.map((step, index) => {
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
            {index < STEPS.length - 1 ? (
              <div className={"mx-2 h-px flex-1 " + (isComplete ? "bg-nhs-green" : "bg-border-default")} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
