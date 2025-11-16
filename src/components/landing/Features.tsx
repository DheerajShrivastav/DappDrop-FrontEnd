'use client'

import { motion } from 'framer-motion'
import { Zap, Users, Shield, Award, TrendingUp, Lock } from 'lucide-react'

const features = [
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Lightning Fast',
    description: 'Deploy campaigns in minutes with our intuitive interface and automated workflows.'
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Real Community',
    description: 'Connect with genuine users through verified on-chain interactions and tasks.'
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Sybil Resistant',
    description: 'Advanced bot detection ensures only real users join your community.'
  },
  {
    icon: <Award className="w-6 h-6" />,
    title: 'Fair Rewards',
    description: 'Distribute NFTs, tokens, and rewards transparently through smart contracts.'
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    title: 'Growth Analytics',
    description: 'Track engagement, monitor growth, and optimize your campaigns in real-time.'
  },
  {
    icon: <Lock className="w-6 h-6" />,
    title: 'Secure & Trustless',
    description: 'Built on blockchain technology for complete transparency and security.'
  }
]

export default function Features() {
  return (
    <section id="features" className="py-24 px-6 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Why Choose DAppDrop
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to build and grow an authentic community
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group p-8 bg-white rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all duration-300"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center text-purple-600 mb-5 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
