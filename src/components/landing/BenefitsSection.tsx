'use client'

import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

const benefits = [
  {
    title: 'Verifiable On-Chain Actions',
    description: 'Every task completion is recorded on-chain, ensuring transparency and trust.'
  },
  {
    title: 'Automated & Trustless',
    description: 'Smart contracts handle validation and rewards automatically, no middlemen needed.'
  },
  {
    title: 'Sybil Resistant',
    description: 'Advanced verification filters out bots, ensuring only genuine users participate.'
  }
]

export default function BenefitsSection() {
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Ditch the Bots.
              <br />
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Find Your Tribe.
              </span>
            </h2>
            
            <p className="text-xl text-gray-600 mb-10">
              Build a community of real, engaged users who genuinely care about your project.
            </p>

            <div className="space-y-6">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="flex gap-4"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900 mb-1">
                      {benefit.title}
                    </h4>
                    <p className="text-gray-600">
                      {benefit.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Visual */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative aspect-square bg-gradient-to-br from-purple-100 to-blue-100 rounded-3xl p-12">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-3xl"></div>
              
              {/* Central Card */}
              <div className="relative z-10 h-full bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center justify-center">
                <div className="text-7xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
                  100%
                </div>
                <div className="text-2xl font-semibold text-gray-900 mb-2">Real Users</div>
                <div className="text-gray-600 text-center">
                  Verified & Engaged Community
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-purple-500 rounded-full opacity-20 blur-2xl"></div>
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-blue-500 rounded-full opacity-20 blur-2xl"></div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
