'use client'

import { useEffect, useRef, useState } from 'react'

interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    opacity: number
}

export function InteractiveHeroBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [particles, setParticles] = useState<Particle[]>([])
    const mousePos = useRef({ x: 0, y: 0 })
    const animationRef = useRef<number>()

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size
        const resizeCanvas = () => {
            canvas.width = canvas.offsetWidth
            canvas.height = canvas.offsetHeight
        }
        resizeCanvas()
        window.addEventListener('resize', resizeCanvas)

        // Initialize particles
        const particleCount = 60
        const initialParticles: Particle[] = []

        for (let i = 0; i < particleCount; i++) {
            initialParticles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 3 + 1,
                opacity: Math.random() * 0.5 + 0.2,
            })
        }
        setParticles(initialParticles)

        // Mouse move handler
        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect()
            mousePos.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            }
        }
        canvas.addEventListener('mousemove', handleMouseMove)

        // Animation loop
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            initialParticles.forEach((particle, index) => {
                // Calculate distance to mouse
                const dx = mousePos.current.x - particle.x
                const dy = mousePos.current.y - particle.y
                const distance = Math.sqrt(dx * dx + dy * dy)
                const maxDistance = 150

                // Apply gravitational pull towards mouse
                if (distance < maxDistance) {
                    const force = (maxDistance - distance) / maxDistance
                    particle.vx += (dx / distance) * force * 0.2
                    particle.vy += (dy / distance) * force * 0.2
                }

                // Apply slight friction
                particle.vx *= 0.95
                particle.vy *= 0.95

                // Update position
                particle.x += particle.vx
                particle.y += particle.vy

                // Bounce off walls
                if (particle.x < 0 || particle.x > canvas.width) {
                    particle.vx *= -0.8
                    particle.x = Math.max(0, Math.min(canvas.width, particle.x))
                }
                if (particle.y < 0 || particle.y > canvas.height) {
                    particle.vy *= -0.8
                    particle.y = Math.max(0, Math.min(canvas.height, particle.y))
                }

                // Draw particle
                ctx.beginPath()
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(23, 23, 23, ${particle.opacity})`
                ctx.fill()

                // Draw connections to nearby particles
                initialParticles.forEach((otherParticle, otherIndex) => {
                    if (index === otherIndex) return

                    const dx = particle.x - otherParticle.x
                    const dy = particle.y - otherParticle.y
                    const distance = Math.sqrt(dx * dx + dy * dy)

                    if (distance < 100) {
                        ctx.beginPath()
                        ctx.moveTo(particle.x, particle.y)
                        ctx.lineTo(otherParticle.x, otherParticle.y)
                        const opacity = (1 - distance / 100) * 0.15
                        ctx.strokeStyle = `rgba(23, 23, 23, ${opacity})`
                        ctx.lineWidth = 0.5
                        ctx.stroke()
                    }
                })
            })

            animationRef.current = requestAnimationFrame(animate)
        }
        animate()

        return () => {
            window.removeEventListener('resize', resizeCanvas)
            canvas.removeEventListener('mousemove', handleMouseMove)
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-auto"
            style={{ opacity: 0.6 }}
        />
    )
}
