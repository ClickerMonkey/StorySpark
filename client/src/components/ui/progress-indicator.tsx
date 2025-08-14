import { cn } from "@/lib/utils";

interface ProgressStep {
  number: number;
  label: string;
  completed: boolean;
  current: boolean;
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  className?: string;
}

export function ProgressIndicator({ steps, className }: ProgressIndicatorProps) {
  return (
    <div className={cn("flex items-center justify-center space-x-4 mb-4", className)}>
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className="flex items-center">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm",
                step.completed || step.current
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-300 text-gray-600"
              )}
              data-testid={`step-${step.number}`}
            >
              {step.number}
            </div>
            <span
              className={cn(
                "ml-2 text-sm font-medium",
                step.completed || step.current
                  ? "text-indigo-600"
                  : "text-gray-500"
              )}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "w-16 h-1 rounded ml-4",
                step.completed ? "bg-indigo-600" : "bg-gray-300"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
