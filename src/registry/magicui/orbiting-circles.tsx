'use client'

import { Children, ReactNode } from 'react'
import { motion } from 'framer-motion'

interface OrbitingCirclesProps {
  iconSize?: number
  radius?: number
  speed?: number
  reverse?: boolean
  children: ReactNode
}

export function OrbitingCircles({
  iconSize = 40,
  radius = 140,
  speed = 1,
  reverse = false,
  children,
}: OrbitingCirclesProps) {
  const icons = Children.toArray(children)
  const diameter = radius * 2 + iconSize * 2
  const rotationDuration = Math.max(4, 24 / Math.max(speed, 0.25))

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: `${diameter}px`, height: `${diameter}px` }}
    >
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: reverse ? -360 : 360 }}
        transition={{ repeat: Infinity, ease: 'linear', duration: rotationDuration }}
      >
        {icons.map((icon, index) => {
          const angle = (360 / icons.length) * index
          return (
            <div
              key={index}
              className="absolute left-1/2 top-1/2 flex items-center justify-center"
              style={{
                width: `${iconSize}px`,
                height: `${iconSize}px`,
                marginLeft: `-${iconSize / 2}px`,
                marginTop: `-${iconSize / 2}px`,
                transform: `rotate(${angle}deg) translate(${radius}px) rotate(${-angle}deg)`,
              }}
            >
              {icon}
            </div>
          )
        })}
      </motion.div>

      <div className="absolute left-1/2 top-1/2 h-[1px] w-[1px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
    </div>
  )
}
