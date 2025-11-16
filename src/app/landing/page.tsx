'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useSpring, useInView, useMotionValue } from 'framer-motion'
import Link from 'next/link'


function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/10 backdrop-blur-xl border-b border-white/20 shadow-lg shadow-white/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black tracking-tight text-white">
          DAppDrop
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/#campaigns"
            className="hidden md:block text-white font-medium hover:text-white/80 transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/create-campaign"
            className="group relative overflow-hidden px-6 py-2.5 bg-white/10 backdrop-blur-md text-white font-bold rounded-full border border-white/20 hover:shadow-lg hover:shadow-white/20 transition-all duration-300"
          >
            <span className="relative z-10">Create Campaign</span>
          </Link>
        </div>
      </div>
    </motion.nav>
  )
}

// Community Constellation - The Hero Centerpiece (Mouse-Reactive)
function CommunityConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  
  const springConfig = { damping: 25, stiffness: 150, mass: 0.5 }
  const smoothMouseX = useSpring(mouseX, springConfig)
  const smoothMouseY = useSpring(mouseY, springConfig)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const updateSize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    updateSize()
    window.addEventListener('resize', updateSize)

    // Create luminous nodes
    const nodes: Array<{
      x: number
      y: number
      baseX: number
      baseY: number
      radius: number
      speed: number
      angle: number
    }> = []

    const nodeCount = 100
    const centerX = canvas.offsetWidth / 2
    const centerY = canvas.offsetHeight / 2

    for (let i = 0; i < nodeCount; i++) {
      const angle = (Math.PI * 2 * i) / nodeCount
      const distance = 100 + Math.random() * 250
      const baseX = centerX + Math.cos(angle) * distance
      const baseY = centerY + Math.sin(angle) * distance

      nodes.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        radius: 1.5 + Math.random() * 2.5,
        speed: 0.0001 + Math.random() * 0.0002,
        angle: angle,
      })
    }

    let animationId: number
    let mouseXPos = centerX
    let mouseYPos = centerY

    const unsubscribeX = smoothMouseX.on('change', (v) => {
      mouseXPos = v
    })
    const unsubscribeY = smoothMouseY.on('change', (v) => {
      mouseYPos = v
    })

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

      // Draw connections first (luminous white lines)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.lineWidth = 1
      
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 120) {
            const opacity = (1 - distance / 120) * 0.15
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Update and draw nodes
      nodes.forEach((node) => {
        // Gentle orbit animation
        node.angle += node.speed
        node.x = node.baseX + Math.cos(node.angle) * 15
        node.y = node.baseY + Math.sin(node.angle) * 15

        // Mouse interaction (magnetic attraction like a field)
        const dx = mouseXPos - node.x
        const dy = mouseYPos - node.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance < 180) {
          const force = (180 - distance) / 180
          node.x += dx * force * 0.03
          node.y += dy * force * 0.03
        }

        // Draw node with luminous glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 4)
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)')
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius * 4, 0, Math.PI * 2)
        ctx.fill()

        // Draw core
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fill()
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', updateSize)
      unsubscribeX()
      unsubscribeY()
    }
  }, [smoothMouseX, smoothMouseY])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left)
    mouseY.set(e.clientY - rect.top)
  }

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      className="absolute inset-0 w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  )
}

// Hero Section - The Show-Stopper
function Hero() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.2,
      },
    },
  }

  const wordVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        type: 'spring',
        stiffness: 80,
      },
    },
  }

  const ctaVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        type: 'spring',
        stiffness: 100,
      },
    },
  }

  return (
    <section 
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{
        background: '#EEAECA',
        backgroundImage: 'radial-gradient(circle, rgba(238, 174, 202, 1) 0%, rgba(148, 187, 233, 1) 100%)',
      }}
    >
      {/* Constellation Background */}
      <div className="absolute inset-0 opacity-30">
        <CommunityConstellation />
      </div>

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-6xl mx-auto px-6 text-center"
      >
        {/* Badge */}
        <motion.div
          variants={wordVariants}
          className="inline-block mb-10 px-8 py-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20"
        >
          <span className="text-sm font-bold text-white tracking-wider">
            FIND THE NEXT BILLION REAL USERS FOR YOUR PROJECT
          </span>
        </motion.div>

        {/* Headline - staggerChildren word animation */}
        <div className="mb-6 overflow-hidden">
          <motion.h1 className="text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black tracking-tighter text-white leading-[0.92]">
            {['Find', 'The', 'Next', 'Billion', 'Real', 'Users'].map((word, i) => (
              <motion.span
                key={i}
                variants={wordVariants}
                className="inline-block mr-4 md:mr-6"
              >
                {word}
              </motion.span>
            ))}
          </motion.h1>
        </div>

        <div className="mb-8 overflow-hidden">
          <motion.h2 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white/95 leading-tight">
            {['A', 'New', 'Era', 'of', 'Community', 'Building'].map((word, i) => (
              <motion.span
                key={i}
                variants={wordVariants}
                className="inline-block mr-3 md:mr-5"
              >
                {word}
              </motion.span>
            ))}
          </motion.h2>
        </div>

        {/* Subheadline */}
        <motion.p
          variants={wordVariants}
          className="text-xl md:text-2xl text-white/90 font-medium max-w-3xl mx-auto mb-14 leading-relaxed"
        >
          The ultimate platform to launch your project, engage real users, and
          build a thriving community on-chain.{' '}
          <span className="font-black text-white">
            Ditch the bots, find your tribe.
          </span>
        </motion.p>

        {/* CTAs - Glassmorphism */}
        <motion.div
          variants={containerVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-5"
        >
          <motion.div variants={ctaVariants}>
            <Link
              href="/#campaigns"
              className="group relative overflow-hidden px-10 py-4 bg-white/15 backdrop-blur-md text-white font-bold rounded-full text-lg inline-flex items-center gap-3 border border-white/30 hover:bg-white/25 hover:shadow-xl hover:shadow-white/30 transition-all duration-300"
            >
              <span className="relative z-10">Explore</span>
              <motion.span
                className="relative z-10"
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              >
                →
              </motion.span>
            </Link>
          </motion.div>

          <motion.div variants={ctaVariants}>
            <Link
              href="/create-campaign"
              className="group px-10 py-4 bg-white/20 backdrop-blur-md border-2 border-white/40 text-white font-bold rounded-full text-lg inline-flex items-center gap-3 hover:bg-white/30 hover:shadow-xl hover:shadow-white/30 transition-all duration-300"
            >
              <span>Create</span>
              <motion.span
                animate={{ rotate: [0, 90, 0] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                +
              </motion.span>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 1, repeat: Infinity, repeatType: 'reverse' }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2"
      >
        <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center backdrop-blur-sm">
          <motion.div
            className="w-1.5 h-1.5 bg-white rounded-full mt-2"
            animate={{ y: [0, 16, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  )
}

// How It Works - Scroll-Driven Timeline with SVG Path Drawing
function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const pathLength = useTransform(scrollYProgress, [0.1, 0.9], [0, 1])

  const steps = [
    {
      number: '01',
      title: 'Launch Your Campaign',
      description:
        'Easily create and customize campaigns to attract and onboard your ideal users. Set tasks, rewards, and watch your community grow.',
    },
    {
      number: '02',
      title: 'Engage Real Users',
      description:
        'Participants discover new projects, complete meaningful tasks, and prove their engagement through verifiable on-chain actions.',
    },
    {
      number: '03',
      title: 'Grow Your Community',
      description:
        'Reward genuine participation and turn new users into a valuable, long-term community. Build trust through transparency.',
    },
  ]

  return (
    <section
      ref={containerRef}
      className="relative py-32 overflow-hidden"
      style={{
        background: '#EEAECA',
        backgroundImage: 'radial-gradient(circle, rgba(238, 174, 202, 1) 0%, rgba(148, 187, 233, 1) 100%)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-28"
        >
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight mb-5">
            How It Works
          </h2>
          <p className="text-xl md:text-2xl text-white/80 font-medium">
            Three simple steps to build your tribe
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical SVG Line - Draws on Scroll */}
          <div className="absolute left-8 md:left-24 top-0 bottom-0 w-1">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <motion.line
                x1="50%"
                y1="0%"
                x2="50%"
                y2="100%"
                stroke="rgba(255, 255, 255, 0.6)"
                strokeWidth="3"
                strokeLinecap="round"
                style={{ pathLength }}
                initial={{ pathLength: 0 }}
              />
            </svg>
          </div>

          {/* Steps */}
          <div className="space-y-28 md:space-y-36">
            {steps.map((step, index) => (
              <StepItem key={index} step={step} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function StepItem({
  step,
  index,
}: {
  step: { number: string; title: string; description: string }
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: false, amount: 0.5 })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -50 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
      transition={{ duration: 0.8, type: 'spring', stiffness: 80 }}
      className="relative flex items-start gap-8 md:gap-16"
    >
      {/* Number Badge - Frosted Glass */}
      <motion.div
        animate={
          isInView
            ? { scale: 1, backgroundColor: 'rgba(255, 255, 255, 0.2)' }
            : { scale: 0.8, backgroundColor: 'rgba(255, 255, 255, 0.05)' }
        }
        transition={{ duration: 0.5 }}
        className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-full border-3 border-white/40 flex items-center justify-center relative z-10 backdrop-blur-md"
        style={{ borderWidth: '3px' }}
      >
        <span className="text-2xl md:text-3xl font-black text-white">
          {step.number}
        </span>
      </motion.div>

      {/* Content - Frosted Glass Card */}
      <motion.div
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="flex-1 pt-0 p-8 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 hover:bg-white/15 hover:shadow-xl hover:shadow-white/20 transition-all duration-300"
      >
        <h3 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mb-4 tracking-tight">
          {step.title}
        </h3>
        <p className="text-lg md:text-xl text-white/85 font-medium leading-relaxed">
          {step.description}
        </p>
      </motion.div>
    </motion.div>
  )
}

// Proof Section - Bot Filter Visualization (Asymmetrical Layout)
function ProofSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const updateSize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    updateSize()
    window.addEventListener('resize', updateSize)

    // Particles (luminous white for users, dark faded for bots)
    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      radius: number
      type: 'bot' | 'user'
      filtered: boolean
    }> = []

    const width = canvas.offsetWidth
    const height = canvas.offsetHeight
    const filterX = width * 0.5

    // Generate particles
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * width * 0.35,
        y: Math.random() * height,
        vx: 0.8 + Math.random() * 1.5,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 3 + Math.random() * 3,
        type: Math.random() > 0.55 ? 'user' : 'bot',
        filtered: false,
      })
    }

    let animationId: number

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      // Draw filter line (luminous white)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 5
      ctx.setLineDash([12, 6])
      ctx.beginPath()
      ctx.moveTo(filterX, 0)
      ctx.lineTo(filterX, height)
      ctx.stroke()
      ctx.setLineDash([])

      // Add glow to filter line
      ctx.shadowBlur = 20
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)'
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 15
      ctx.beginPath()
      ctx.moveTo(filterX, 0)
      ctx.lineTo(filterX, height)
      ctx.stroke()
      ctx.shadowBlur = 0

      // Update and draw particles
      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy

        // Reset if off screen
        if (p.x > width + 50) {
          p.x = -50
          p.y = Math.random() * height
          p.filtered = false
        }

        // Filter logic
        if (p.x > filterX && !p.filtered) {
          p.filtered = true
          if (p.type === 'bot') {
            // Bots bounce away
            p.vy = p.y < height / 2 ? -3 : 3
            p.vx = -Math.abs(p.vx) * 0.8
          }
        }

        // Draw particle
        if (p.type === 'user') {
          // Luminous white/pink for real users
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2)
          gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
          gradient.addColorStop(0.5, 'rgba(255, 182, 193, 0.8)')
          gradient.addColorStop(1, 'rgba(255, 182, 193, 0)')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // Dark, faded dots for bots
          const alpha = p.filtered ? 0.2 : 0.4
          ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  return (
    <section 
      className="relative py-32 overflow-hidden"
      style={{
        background: '#EEAECA',
        backgroundImage: 'radial-gradient(circle, rgba(238, 174, 202, 1) 0%, rgba(148, 187, 233, 1) 100%)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Left: Animated Bot Filter Graphic */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, type: 'spring', stiffness: 80 }}
            className="relative order-2 md:order-1"
          >
            <div className="relative aspect-square rounded-3xl overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl shadow-white/10">
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -bottom-6 -right-6 w-40 h-40 bg-white/30 rounded-full blur-3xl"
            />
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2, type: 'spring', stiffness: 80 }}
            className="order-1 md:order-2"
          >
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight mb-10 leading-tight">
              Ditch the Bots.
              <br />
              Find Your Tribe.
            </h2>

            <div className="space-y-6">
              {[
                {
                  title: 'Verifiable On-Chain Actions',
                  text: 'Tasks are completed and verified directly through smart contracts, proving genuine participation.',
                },
                {
                  title: 'Automated & Trustless',
                  text: 'The smart contract handles everything from task validation to reward distribution.',
                },
                {
                  title: 'Sybil Resistant',
                  text: 'Requiring wallet connection and on-chain interactions naturally filters out bots.',
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
                  className="flex items-start gap-5 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 hover:bg-white/15 hover:shadow-lg hover:shadow-white/20 transition-all duration-300"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xl md:text-2xl font-black text-white mb-2">
                      {item.title}
                    </h4>
                    <p className="text-white/85 font-medium leading-relaxed text-base md:text-lg">
                      {item.text}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// Footer - Glassmorphism
function Footer() {
  return (
    <footer 
      className="relative py-16 border-t border-white/20"
      style={{
        background: '#EEAECA',
        backgroundImage: 'radial-gradient(circle, rgba(238, 174, 202, 1) 0%, rgba(148, 187, 233, 1) 100%)',
      }}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          <div>
            <h3 className="text-2xl font-black mb-4 text-white">DAppDrop</h3>
            <p className="text-white/80 font-medium">
              Building the future of community engagement, one campaign at a time.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-white">
              Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-white/80 hover:text-white transition-colors font-medium"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-white/80 hover:text-white transition-colors font-medium"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-white/80 hover:text-white transition-colors font-medium"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-white">
              Resources
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/changelog"
                  className="text-white/80 hover:text-white transition-colors font-medium"
                >
                  Changelog
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white transition-colors font-medium"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/70 text-sm font-medium">
            © 2025 DAppDrop. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-white/70 hover:text-white transition-colors font-medium"
            >
              Twitter
            </a>
            <a
              href="#"
              className="text-white/70 hover:text-white transition-colors font-medium"
            >
              Discord
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// Main Landing Page Component
export default function EtherealLandingPage() {
  return (
    <div className="font-satoshi">
      <Navbar />
      <Hero />
      <HowItWorks />
      <ProofSection />
      <Footer />
    </div>
  )
}
