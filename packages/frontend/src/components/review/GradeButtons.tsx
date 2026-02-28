import { Button } from '@/components/ui/button'
import { motion, useReducedMotion } from 'framer-motion'
import type { Grade } from '@/types'

interface GradeButtonsProps {
  disabled: boolean
  onGrade: (grade: Grade) => void
}

const gradeConfigs = [
  {
    grade: 0 as Grade,
    label: 'Again',
    color: 'rgb(239, 68, 68)',
    shadowColor: 'rgba(239, 68, 68, 0.2)',
  },
  {
    grade: 2 as Grade,
    label: 'Hard',
    color: 'rgb(245, 158, 11)',
    shadowColor: 'rgba(245, 158, 11, 0.2)',
  },
  {
    grade: 3 as Grade,
    label: 'Good',
    color: 'rgb(34, 197, 94)',
    shadowColor: 'rgba(34, 197, 94, 0.2)',
  },
  {
    grade: 4 as Grade,
    label: 'Easy',
    color: 'rgb(99, 102, 241)',
    shadowColor: 'rgba(99, 102, 241, 0.2)',
  },
]

export function GradeButtons({ disabled, onGrade }: GradeButtonsProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-xs mx-auto md:flex md:flex-wrap md:justify-center md:max-w-none md:w-auto">
      {gradeConfigs.map((config, index) => (
        <motion.div
          key={config.grade}
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8, y: 20 }}
          animate={
            disabled
              ? shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.8, y: 20 }
              : shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0.15 }
              : {
                  type: 'spring',
                  stiffness: 400,
                  damping: 20,
                  delay: disabled ? 0 : index * 0.08,
                }
          }
          className="motion-reduce:transition-none"
        >
          <Button
            variant="ghost"
            onClick={() => onGrade(config.grade)}
            disabled={disabled}
            className="relative w-full min-h-[48px] md:min-w-[100px] md:w-auto rounded-2xl px-6 py-4 font-normal text-foreground
              transition-all duration-200 bg-white/40
              hover:scale-105 hover:-translate-y-1 hover:bg-white/50 hover:text-foreground
              active:scale-95 active:translate-y-0
              disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 disabled:opacity-50
              border border-white/40
              motion-reduce:hover:scale-100 motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
            style={{
              boxShadow: `0 8px 24px ${config.shadowColor}, 0 2px 8px rgba(0, 0, 0, 0.08)`,
            }}
          >
            <div className="flex flex-col items-center gap-1">
              <div
                className="h-1.5 w-8 rounded-full mb-1"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-sm tracking-wide">{config.label}</span>
            </div>
          </Button>
        </motion.div>
      ))}
    </div>
  )
}
