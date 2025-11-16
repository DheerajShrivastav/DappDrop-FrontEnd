'use client'

import { motion } from 'framer-motion'
import { Rocket, Target, TrendingUp } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: <Rocket className="w-8 h-8" />,
    title: 'Launch Your Campaign',
    description: 'Create and customize campaigns with tasks, rewards, and requirements tailored to your project goals.'
  },
  {
    number: '02',
    icon: <Target className="w-8 h-8" />,
    title: 'Engage Real Users',
    description: 'Participants discover your project, complete meaningful tasks, and verify their participation on-chain.'
  },
  {
    number: '03',
    icon: <TrendingUp className="w-8 h-8" />,
    title: 'Grow Your Community',
    description: 'Reward genuine participants and transform them into loyal community members who believe in your vision.'
  }
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Three simple steps to build your thriving community
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-12 relative">
          {/* Connecting Line */}
          <div className="hidden md:block absolute top-20 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-200 via-blue-200 to-purple-200"></div>

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Number Badge */}
              <div className="relative z-10 w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl mb-6 mx-auto shadow-lg">
                {step.number}
              </div>

              {/* Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center text-purple-600 mb-6 mx-auto">
                {step.icon}
              </div>

              {/* Content */}
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
