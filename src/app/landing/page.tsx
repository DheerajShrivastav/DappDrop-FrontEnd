'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform, useSpring, useInView, useMotionValue } from 'framer-motion'
import Link from 'next/link'

// ============================================================================
// DESIGN ENGINEER'S RATIONALE
// ============================================================================
// 
// Philosophy: "Organic Minimalism"
// 
// This landing page embodies the core principles of Organic Minimalism:
// 
// 1. WARMTH IN MINIMALISM:
//    - Pure white (#FFFFFF) base creates space and clarity
//    - Soft charcoal (#1E1E1E) text prevents harshness
//    - Solar Orange (#FF6B00) injects energy and human connection
//    - Generous spacing lets each element breathe
// 
// 2. PHYSICS-BASED MOTION:
//    - All animations use spring physics (useSpring) for natural, organic feel
//    - Scroll-driven reveals (useScroll) create narrative progression
//    - Staggered children animations build anticipation
//    - Mouse-reactive elements add playful interactivity
// 
// 3. ASYMMETRICAL DYNAMISM:
//    - Breaking from rigid centered layouts
//    - Creative positioning guides the eye naturally
//    - Negative space as a primary design element
// 
// 4. PURPOSE-DRIVEN ANIMATION:
//    - Hero constellation: Visualizes community connection
//    - Timeline line draw: Shows progression and journey
//    - Bot filter: Demonstrates value proposition visually
//    - Every motion serves the narrative
//
// ============================================================================

// Navbar Component - Minimal, Sticky, Blurred on Scroll
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
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/80 backdrop-blur-xl border-b border-[#1E1E1E]/5 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 flex items-center justify-between">
        <Link href="/" className="text-2xl font-black tracking-tight text-[#1E1E1E]">
          DAppDrop
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/#campaigns"
            className="hidden md:block text-[#1E1E1E] font-medium hover:text-[#FF6B00] transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/create-campaign"
            className="relative overflow-hidden px-6 py-2.5 bg-[#FF6B00] text-white font-bold rounded-full group"
          >
            <motion.span
              className="absolute inset-0 bg-gradient-to-r from-[#FF6B00] to-[#FF8C00]"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            />
            <span className="relative z-10">Create Campaign</span>
          </Link>
        </div>
      </div>
    </motion.nav>
  )
}

// Community Constellation - The Hero Centerpiece
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

    // Create nodes (users in the community)
    const nodes: Array<{
      x: number
      y: number
      baseX: number
      baseY: number
      radius: number
      speed: number
      angle: number
    }> = []

    const nodeCount = 80
    const centerX = canvas.offsetWidth / 2
    const centerY = canvas.offsetHeight / 2

    for (let i = 0; i < nodeCount; i++) {
      const angle = (Math.PI * 2 * i) / nodeCount
      const distance = 150 + Math.random() * 200
      const baseX = centerX + Math.cos(angle) * distance
      const baseY = centerY + Math.sin(angle) * distance

      nodes.push({
        x: baseX,
        y: baseY,
        baseX,
        baseY,
        radius: 2 + Math.random() * 3,
        speed: 0.0002 + Math.random() * 0.0003,
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

      // Draw connections first (behind nodes)
      ctx.strokeStyle = 'rgba(255, 107, 0, 0.08)'
      ctx.lineWidth = 1
      
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 150) {
            const opacity = (1 - distance / 150) * 0.3
            ctx.strokeStyle = `rgba(255, 107, 0, ${opacity})`
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Update and draw nodes
      nodes.forEach((node, i) => {
        // Orbit animation
        node.angle += node.speed
        node.x = node.baseX + Math.cos(node.angle) * 20
        node.y = node.baseY + Math.sin(node.angle) * 20

        // Mouse interaction (magnetic attraction)
        const dx = mouseXPos - node.x
        const dy = mouseYPos - node.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance < 200) {
          const force = (200 - distance) / 200
          node.x += dx * force * 0.05
          node.y += dy * force * 0.05
        }

        // Draw node with glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 3)
        gradient.addColorStop(0, 'rgba(255, 107, 0, 0.8)')
        gradient.addColorStop(0.5, 'rgba(255, 107, 0, 0.3)')
        gradient.addColorStop(1, 'rgba(255, 107, 0, 0)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius * 3, 0, Math.PI * 2)
        ctx.fill()

        // Draw core
        ctx.fillStyle = '#FF6B00'
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
        staggerChildren: 0.15,
        delayChildren: 0.3,
      },
    },
  }

  const wordVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  }

  const ctaVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
      {/* Constellation Background */}
      <div className="absolute inset-0 opacity-40">
        <CommunityConstellation />
      </div>

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 max-w-5xl mx-auto px-6 text-center"
      >
        {/* Badge */}
        <motion.div
          variants={wordVariants}
          className="inline-block mb-8 px-6 py-2 bg-[#FF6B00]/10 rounded-full border border-[#FF6B00]/20"
        >
          <span className="text-sm font-bold text-[#FF6B00] tracking-wide">
            FIND THE NEXT BILLION REAL USERS FOR YOUR PROJECT
          </span>
        </motion.div>

        {/* Headline - Word by word animation */}
        <div className="mb-6 overflow-hidden">
          <motion.h1 className="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter text-[#1E1E1E] leading-[0.95]">
            {['A', 'New', 'Era', 'of', 'Community', 'Building'].map((word, i) => (
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

        {/* Subheadline */}
        <motion.p
          variants={wordVariants}
          className="text-xl md:text-2xl text-[#1E1E1E]/70 font-medium max-w-3xl mx-auto mb-12 leading-relaxed"
        >
          The ultimate platform to launch your project, engage real users, and
          build a thriving community on-chain.{' '}
          <span className="text-[#FF6B00] font-bold">
            Ditch the bots, find your tribe.
          </span>
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={containerVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <motion.div variants={ctaVariants}>
            <Link
              href="/#campaigns"
              className="group relative overflow-hidden px-8 py-4 bg-[#FF6B00] text-white font-bold rounded-full text-lg inline-flex items-center gap-2"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-[#FF8C00] to-[#FF6B00]"
                initial={{ clipPath: 'circle(0% at 50% 50%)' }}
                whileHover={{
                  clipPath: 'circle(150% at 50% 50%)',
                  transition: { duration: 0.5, ease: 'easeOut' },
                }}
              />
              <span className="relative z-10">Explore Campaigns</span>
              <motion.span
                className="relative z-10"
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </Link>
          </motion.div>

          <motion.div variants={ctaVariants}>
            <Link
              href="/create-campaign"
              className="group px-8 py-4 bg-transparent border-2 border-[#1E1E1E] text-[#1E1E1E] font-bold rounded-full text-lg inline-flex items-center gap-2 hover:bg-[#1E1E1E] hover:text-white transition-all duration-300"
            >
              <span>Create Your Campaign</span>
              <motion.span
                animate={{ rotate: [0, 90, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
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
        <div className="w-6 h-10 border-2 border-[#1E1E1E]/20 rounded-full flex justify-center">
          <motion.div
            className="w-1.5 h-1.5 bg-[#FF6B00] rounded-full mt-2"
            animate={{ y: [0, 16, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  )
}

// How It Works - Scroll-Driven Timeline
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
      className="relative py-32 bg-white overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-24"
        >
          <h2 className="text-5xl md:text-6xl font-black text-[#1E1E1E] tracking-tight mb-4">
            How It Works
          </h2>
          <p className="text-xl text-[#1E1E1E]/60 font-medium">
            Three simple steps to build your tribe
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical SVG Line */}
          <div className="absolute left-8 md:left-24 top-0 bottom-0 w-1">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <motion.line
                x1="50%"
                y1="0%"
                x2="50%"
                y2="100%"
                stroke="#FF6B00"
                strokeWidth="3"
                strokeLinecap="round"
                style={{ pathLength }}
                initial={{ pathLength: 0 }}
              />
            </svg>
          </div>

          {/* Steps */}
          <div className="space-y-24 md:space-y-32">
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
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex items-start gap-8 md:gap-16"
    >
      {/* Number Badge */}
      <motion.div
        animate={
          isInView
            ? { scale: 1, backgroundColor: '#FF6B00' }
            : { scale: 0.8, backgroundColor: '#FFFFFF' }
        }
        transition={{ duration: 0.5 }}
        className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-[#FF6B00] flex items-center justify-center relative z-10"
      >
        <span className="text-2xl md:text-3xl font-black text-white">
          {step.number}
        </span>
      </motion.div>

      {/* Content */}
      <div className="flex-1 pt-2">
        <motion.h3
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-3xl md:text-4xl font-black text-[#1E1E1E] mb-4 tracking-tight"
        >
          {step.title}
        </motion.h3>
        <motion.p
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg md:text-xl text-[#1E1E1E]/70 font-medium leading-relaxed max-w-2xl"
        >
          {step.description}
        </motion.p>
      </div>
    </motion.div>
  )
}

// Proof Section - Bot Filter Visualization
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

    // Particles
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
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * width * 0.4,
        y: Math.random() * height,
        vx: 1 + Math.random() * 2,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 3 + Math.random() * 2,
        type: Math.random() > 0.6 ? 'user' : 'bot',
        filtered: false,
      })
    }

    let animationId: number

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      // Draw filter line
      ctx.strokeStyle = '#FF6B00'
      ctx.lineWidth = 4
      ctx.setLineDash([10, 5])
      ctx.beginPath()
      ctx.moveTo(filterX, 0)
      ctx.lineTo(filterX, height)
      ctx.stroke()
      ctx.setLineDash([])

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
            p.vy = p.y < height / 2 ? -3 : 3 // Bounce away
            p.vx = -p.vx
          }
        }

        // Draw particle
        const color = p.type === 'user' ? '#FF6B00' : '#CCCCCC'
        const alpha = p.type === 'bot' && p.filtered ? 0.3 : 0.8

        ctx.fillStyle = `${color}${Math.round(alpha * 255)
          .toString(16)
          .padStart(2, '0')}`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
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
    <section className="relative py-32 bg-[#FAFAFA] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Left: Animated Graphic */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative aspect-square rounded-3xl overflow-hidden bg-white shadow-2xl">
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute -bottom-4 -right-4 w-32 h-32 bg-[#FF6B00]/20 rounded-full blur-3xl"
            />
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h2 className="text-5xl md:text-6xl font-black text-[#1E1E1E] tracking-tight mb-8">
              Ditch the Bots.
              <br />
              <span className="text-[#FF6B00]">Find Your Tribe.</span>
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
                  className="flex items-start gap-4"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FF6B00] flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
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
                    <h4 className="text-xl font-bold text-[#1E1E1E] mb-1">
                      {item.title}
                    </h4>
                    <p className="text-[#1E1E1E]/70 font-medium leading-relaxed">
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

// Footer - Minimal and Clean
function Footer() {
  return (
    <footer className="bg-[#1E1E1E] text-white py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          <div>
            <h3 className="text-2xl font-black mb-4">DAppDrop</h3>
            <p className="text-white/60 font-medium">
              Building the future of community engagement, one campaign at a time.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-[#FF6B00]">
              Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="text-white/70 hover:text-[#FF6B00] transition-colors font-medium"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-white/70 hover:text-[#FF6B00] transition-colors font-medium"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-white/70 hover:text-[#FF6B00] transition-colors font-medium"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-[#FF6B00]">
              Resources
            </h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/changelog"
                  className="text-white/70 hover:text-[#FF6B00] transition-colors font-medium"
                >
                  Changelog
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-[#FF6B00] transition-colors font-medium"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/60 text-sm font-medium">
            © 2025 DAppDrop. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-white/60 hover:text-[#FF6B00] transition-colors"
            >
              Twitter
            </a>
            <a
              href="#"
              className="text-white/60 hover:text-[#FF6B00] transition-colors"
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
export default function LandingPage() {
  return (
    <div className="bg-white text-[#1E1E1E]">
      <Navbar />
      <Hero />
      <HowItWorks />
      <ProofSection />
      <Footer />
    </div>
  )
}
