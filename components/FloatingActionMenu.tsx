'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

type FloatingActionMenuProps = {
  options: {
    label: string
    onClick: () => void
    Icon?: React.ReactNode
  }[]
  className?: string
}

export function FloatingActionMenu({ options, className }: FloatingActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn('fixed bottom-8 right-8 z-50', className)}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 w-12 rounded-full border border-white/10 bg-zinc-900/90 text-zinc-100 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl hover:bg-zinc-800/90 hover:border-white/20"
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut', type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Plus className="h-5 w-5" />
        </motion.div>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 10, y: 10, filter: 'blur(10px)' }}
            animate={{ opacity: 1, x: 0, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: 10, y: 10, filter: 'blur(10px)' }}
            transition={{ duration: 0.6, type: 'spring', stiffness: 300, damping: 20, delay: 0.05 }}
            className="absolute bottom-14 right-0 mb-1"
          >
            <div className="flex flex-col items-end gap-2">
              {options.map((option, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25, delay: index * 0.04 }}
                >
                  <Button
                    onClick={() => { setIsOpen(false); option.onClick() }}
                    size="sm"
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/90 px-4 py-2.5 text-xs font-medium text-zinc-100 shadow-[0_0_24px_rgba(0,0,0,0.4)] backdrop-blur-xl hover:border-white/20 hover:bg-zinc-800/90"
                  >
                    {option.Icon}
                    <span className="whitespace-nowrap">{option.label}</span>
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
