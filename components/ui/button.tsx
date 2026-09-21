import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cf-canvas)]",
  {
    variants: {
      variant: {
        default:
          'bg-[var(--cf-accent)] text-[var(--cf-text)] hover:bg-[var(--cf-accent-hover)]',
        destructive:
          'bg-[var(--cf-danger-soft)] text-[var(--cf-danger)] hover:bg-[var(--cf-danger)]/20',
        outline:
          'border border-[var(--cf-border)] bg-transparent text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]',
        secondary:
          'bg-[var(--cf-surface-raised)] text-[var(--cf-text-secondary)] hover:text-[var(--cf-text)]',
        ghost:
          'text-[var(--cf-text-secondary)] hover:bg-[var(--cf-surface-raised)] hover:text-[var(--cf-text)]',
        link: 'text-[var(--cf-text-secondary)] underline-offset-4 hover:text-[var(--cf-text)] hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      suppressHydrationWarning
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
