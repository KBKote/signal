'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  size?: 'default' | 'sm' | 'lg' | 'icon'
  variant?: 'default' | 'ghost' | 'outline'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, asChild = false, size = 'default', variant = 'default', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 disabled:pointer-events-none disabled:opacity-50',
          size === 'default' && 'px-4 py-2 text-sm rounded-lg',
          size === 'sm' && 'px-3 py-1.5 text-xs rounded-lg',
          size === 'lg' && 'px-6 py-3 text-base rounded-xl',
          size === 'icon' && 'h-9 w-9 rounded-lg',
          variant === 'default' && 'bg-white text-black hover:bg-zinc-200',
          variant === 'ghost' && 'bg-transparent text-zinc-100 hover:bg-white/10',
          variant === 'outline' && 'border border-white/20 bg-transparent text-zinc-100 hover:bg-white/5',
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
