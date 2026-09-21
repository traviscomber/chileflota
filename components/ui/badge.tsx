import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--cf-focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--cf-canvas)]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--cf-accent-soft)] text-[var(--cf-text)]",
        secondary: "border-transparent bg-[var(--cf-surface-raised)] text-[var(--cf-text-secondary)]",
        destructive: "border-transparent bg-[var(--cf-danger-soft)] text-[var(--cf-danger)]",
        outline: "border-[var(--cf-border)] text-[var(--cf-text-secondary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
