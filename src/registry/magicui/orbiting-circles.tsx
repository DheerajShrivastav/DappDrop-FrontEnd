'use client'

import { Children, ReactNode, memo, useMemo } from 'react'

interface OrbitingCirclesProps {
  iconSize?: number
  radius?: number
  speed?: number
  reverse?: boolean
  children: ReactNode
}

function OrbitingCirclesComponent({
  iconSize = 40,
  radius = 140,
  speed = 1,
  reverse = false,
  children,
}: OrbitingCirclesProps) {
  const icons = useMemo(() => Children.toArray(children), [children])
  const diameter = radius * 2 + iconSize * 2
  const rotationDuration = Math.max(4, 24 / Math.max(speed, 0.25))
  const animationStyle = useMemo(
    () => ({
      animation: `orbit-spin ${rotationDuration}s linear infinite`,
      animationDirection: reverse ? 'reverse' : 'normal',
      willChange: 'transform',
    }),
    [rotationDuration, reverse]
  )

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: `${diameter}px`, height: `${diameter}px` }}
    >
      <div className="absolute inset-0" style={animationStyle}>
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
                willChange: 'transform',
              }}
            >
              {icon}
            </div>
          )
        })}
      </div>

      <div className="absolute left-1/2 top-1/2 h-[1px] w-[1px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
    </div>
  )
}

export const OrbitingCircles = memo(OrbitingCirclesComponent)
OrbitingCircles.displayName = 'OrbitingCircles'
