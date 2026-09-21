import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      suppressHydrationWarning
      className={cn(
        'flex h-10 w-full min-w-0 rounded-[6px] border border-[var(--cf-border)] bg-[var(--cf-surface-raised)] px-3 py-2 text-base text-[var(--cf-text)] outline-none placeholder:text-[var(--cf-text-muted)] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-[var(--cf-focus-ring)] focus-visible:ring-2 focus-visible:ring-[var(--cf-focus-ring)]/40',
        'aria-invalid:border-[var(--cf-danger)] aria-invalid:ring-[var(--cf-danger)]/20',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
