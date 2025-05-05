import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const progressVariants = cva(
  "h-2.5 w-full bg-secondary rounded-full overflow-hidden",
  {
    variants: {
      variant: {
        default: "",
        success: "",
        warning: "",
        error: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const progressIndicatorVariants = cva(
  "h-full transition-all",
  {
    variants: {
      variant: {
        default: "bg-primary",
        success: "bg-green-500",
        warning: "bg-yellow-500",
        error: "bg-red-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  value?: number
  max?: number
  indicatorClassName?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    { className, indicatorClassName, value = 0, max = 100, variant, ...props },
    ref
  ) => {
    const percentage = value >= 0 && max > 0 ? (value / max) * 100 : 0

    return (
      <div
        ref={ref}
        className={cn(progressVariants({ variant }), className)}
        {...props}
      >
        <div
          className={cn(
            progressIndicatorVariants({ variant }),
            indicatorClassName
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    )
  }
)

Progress.displayName = "Progress"

export { Progress }
