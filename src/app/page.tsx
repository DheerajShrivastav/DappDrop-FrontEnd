'use client'

import Link from 'next/link'
import {
  PlusCircle,
  Rocket,
  Zap,
  Award,
  Twitter,
  Github,
  Bot,
  ShieldCheck,
  DollarSign,
  Image as ImageIcon,
  CheckCircle,
} from 'lucide-react'
import { TestnetBanner } from '@/components/testnet-banner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InteractiveHeroBackground } from '@/components/interactive-hero-background'
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
              <div className="text-4xl font-bold text-primary">10K+</div>
              <div className="text-sm text-slate-600 mt-1">Active Users</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">500+</div>
              <div className="text-sm text-slate-600 mt-1">Campaigns</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary">$2M+</div>
              <div className="text-sm text-slate-600 mt-1">Distributed</div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Showcase Section */}
      <section className="py-24 bg-gradient-soft">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-headline font-bold tracking-tight mb-4">
              Powerful Verification Tools
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Built-in automation for seamless user verification and engagement tracking
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Discord Auto-Verification */}
            <div className="card-modern p-8 group bg-white">
              <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                <Bot className="h-8 w-8 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-headline font-semibold mb-4">Discord Auto-Verification</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Automatically verify Discord server membership with our intelligent bot. Track joins and engagement in real-time.
              </p>
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <CheckCircle className="h-4 w-4" />
                <span>Instant verification</span>
              </div>
            </div>

            {/* Telegram Auto-Verification */}
            <div className="card-modern p-8 group bg-white">
              <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                <Bot className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-headline font-semibold mb-4">Telegram Auto-Verification</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Seamlessly verify Telegram channel membership. Our bot handles everything from user ID verification to join confirmation.
              </p>
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <CheckCircle className="h-4 w-4" />
                <span>Real-time tracking</span>
              </div>
            </div>

            {/* Humanity Protocol Verification */}
            <div className="card-modern p-8 group bg-white">
              <div className="bg-sky-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-headline font-semibold mb-4">Humanity Protocol</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Ensure genuine human participation with integrated Humanity Protocol verification. Say goodbye to bots and sybil attacks.
              </p>
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <CheckCircle className="h-4 w-4" />
                <span>Sybil-resistant</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white border-b">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-headline font-bold tracking-tight text-center mb-16">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="bg-gradient-to-br from-sky-50 to-blue-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-card">
                <Rocket className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-headline font-semibold mb-4">
                Launch Your Campaign
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Easily create and customize campaigns to attract and onboard
                your ideal users.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-br from-sky-50 to-blue-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-card">
                <Zap className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-headline font-semibold mb-4">Engage Real Users</h3>
              <p className="text-slate-600 leading-relaxed">
                Participants discover new projects, complete meaningful tasks,
                and prove their engagement.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-br from-sky-50 to-blue-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-card">
                <Award className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-headline font-semibold mb-4">
                Grow Your Community
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Reward genuine participation and turn new users into a valuable,
                long-term community.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-4">
            Engage Your Way
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            From simple social tasks to complex on-chain actions, design
            campaigns that create genuine engagement and reward users with
            valuable digital assets.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="bg-card border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl">
                  Tasks for Real Engagement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2 rounded-lg mt-1">
                    <Twitter className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Social Follows</h4>
                    <p className="text-sm text-muted-foreground">
                      Grow your community on platforms like X (formerly
                      Twitter).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2 rounded-lg mt-1">
                    <Github className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">GitHub Repo Stars</h4>
                    <p className="text-sm text-muted-foreground">
                      Encourage developers to engage with your open-source code.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2 rounded-lg mt-1">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Join Discord / Telegram</h4>
                    <p className="text-sm text-muted-foreground">
                      Funnel engaged users directly into your community
                      channels.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2 rounded-lg mt-1">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">On-Chain Actions</h4>
                    <p className="text-sm text-muted-foreground">
                      Verify wallet balances, token holds, or specific contract
                      interactions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl">Rewards That Matter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2 rounded-lg mt-1">
                    <ImageIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">On-Chain NFTs</h4>
                    <p className="text-sm text-muted-foreground">
                      Reward loyal users with unique, verifiable digital
                      collectibles (ERC721).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2 rounded-lg mt-1">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Cryptocurrency</h4>
                    <p className="text-sm text-muted-foreground">
                      Distribute your project's native token or other popular
                      tokens (ERC20).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2 rounded-lg mt-1">
                    <Award className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Exclusive Roles & Access</h4>
                    <p className="text-sm text-muted-foreground">
                      Grant special Discord roles or access to token-gated
                      content.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2 rounded-lg mt-1">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">And More...</h4>
                    <p className="text-sm text-muted-foreground">
                      Our flexible system allows for a wide range of creative
                      reward structures.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  )
}

