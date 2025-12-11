'use client'

import Link from 'next/link'
import {
  PlusCircle,
  Rocket,
  Zap,
  Award,
} from 'lucide-react'
import { TestnetBanner } from '@/components/testnet-banner'
import { Button } from '@/components/ui/button'
import { InteractiveHeroBackground } from '@/components/interactive-hero-background'
import { BentoGrid } from '@/components/BentoGrid'
import { CallToAction } from '@/components/CallToAction'
import { UseCasesTabs } from '@/components/UseCasesTabs'
import { motion } from 'framer-motion'

export default function Home() {
  return (
    <>
      {/* Testnet Warning Banner */}
      <TestnetBanner />

      {/* Hero Section with Interactive Background */}
      <motion.section
        className="relative bg-white overflow-hidden border-b"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Grid Pattern Background */}
        <div className="absolute inset-0 bg-grid-pattern opacity-40"></div>

        {/* Interactive Particle Background */}
        <InteractiveHeroBackground />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white"></div>

        <div className="container mx-auto px-4 py-32 md:py-40 text-center relative z-10">
          {/* Pill Badge */}
          <motion.div
            className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-6 py-2.5 text-sm font-medium text-slate-700 mb-8 shadow-soft"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
            </span>
            Find The Next Billion Real Users For Your Project
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            className="text-6xl md:text-8xl font-headline font-bold tracking-tight mb-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <span className="text-gradient-black">
              Community Building
            </span>
            <br />
            <span className="text-foreground">Reimagined</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            className="mt-6 text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-medium"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            The ultimate platform to launch your project, engage real users, and
            build a thriving community on-chain.{' '}
            <span className="text-foreground font-semibold">Ditch the bots, find your tribe.</span>
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="mt-12 flex flex-col sm:flex-row justify-center gap-4"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <Button
              size="lg"
              asChild
              className="bg-primary hover:bg-primary/90 text-white shadow-black-glow h-14 px-10 text-lg font-semibold rounded-xl interactive-lift shimmer"
            >
              <Link href="/campaigns">Explore Campaigns</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="h-14 px-10 text-lg font-semibold border-2 border-slate-200 hover:border-primary hover:bg-slate-50 rounded-xl interactive-lift"
            >
              <Link href="/create-campaign">
                <PlusCircle className="mr-2 h-5 w-5" />
                Create Campaign
              </Link>
            </Button>
          </motion.div>

          {/* Stats/Social Proof */}
          <motion.div
            className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <div>
              <div className="text-4xl font-extrabold text-primary">10K+</div>
              <div className="text-sm text-slate-600 mt-1">Active Users</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-primary">500+</div>
              <div className="text-sm text-slate-600 mt-1">Campaigns</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-primary">$2M+</div>
              <div className="text-sm text-slate-600 mt-1">Distributed</div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Showcase Section (Bento Grid) */}
      <BentoGrid />

      {/* How It Works Section */}
      <section className="py-24 bg-white border-b relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-headline font-bold tracking-tight mb-4">
              How It Works
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Three simple steps to launch your community journey
            </p>
          </div>

          <div className="relative grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-[4.5rem] left-[16%] right-[16%] h-0.5 border-t-2 border-dashed border-slate-200 z-0"></div>

            {/* Step 1 */}
            <div className="relative z-10 text-center group">
              <div className="inline-block bg-white px-4 pb-4">
                <span className="inline-block py-1 px-3 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider mb-4 border border-slate-200">Step 1</span>
                <div className="bg-gradient-to-br from-sky-50 to-blue-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100 group-hover:scale-105 transition-transform duration-300">
                  <Rocket className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h3 className="text-2xl font-headline font-bold mb-3 text-slate-900">
                Launch Campaign
              </h3>
              <p className="text-slate-600 leading-relaxed max-w-xs mx-auto">
                Create and customize campaigns in minutes. Set requirements, rewards, and goals.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 text-center group">
              <div className="inline-block bg-white px-4 pb-4">
                <span className="inline-block py-1 px-3 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider mb-4 border border-slate-200">Step 2</span>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100 group-hover:scale-105 transition-transform duration-300">
                  <Zap className="h-10 w-10 text-indigo-600" />
                </div>
              </div>
              <h3 className="text-2xl font-headline font-bold mb-3 text-slate-900">Engage Users</h3>
              <p className="text-slate-600 leading-relaxed max-w-xs mx-auto">
                Users discover your project and complete meaningful tasks to verify their interest.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 text-center group">
              <div className="inline-block bg-white px-4 pb-4">
                <span className="inline-block py-1 px-3 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider mb-4 border border-slate-200">Step 3</span>
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100 group-hover:scale-105 transition-transform duration-300">
                  <Award className="h-10 w-10 text-emerald-600" />
                </div>
              </div>
              <h3 className="text-2xl font-headline font-bold mb-3 text-slate-900">
                Grow Community
              </h3>
              <p className="text-slate-600 leading-relaxed max-w-xs mx-auto">
                Reward verified users with tokens, NFTs, or roles. Build a loyal user base.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-50 border-b">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-headline font-bold tracking-tight mb-4 text-slate-900">
              Engage Your Way
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Design campaigns that reward genuine engagement your way
            </p>
          </div>
          <UseCasesTabs />
        </div>
      </section>

      {/* Final CTA Section */}
      <CallToAction />
    </>
  )
}
