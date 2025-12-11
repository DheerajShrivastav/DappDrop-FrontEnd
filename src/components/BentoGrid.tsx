'use client'

import React from 'react'
import { motion, Variants } from 'framer-motion'
import {
    ShieldCheck,
    CreditCard,
    Link as LinkIcon,
    Layers,
    ArrowRight,
    CheckCircle,
    ExternalLink,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

// Animation variants for card hover effects
const cardVariants: Variants = {
    initial: { scale: 1, y: 0 },
    hover: {
        scale: 1.02,
        y: -5,
        boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        transition: { duration: 0.3, ease: 'easeOut' },
    },
}

const contentVariants: Variants = {
    initial: { y: 0 },
    hover: { y: -2, transition: { duration: 0.3 } },
}

const iconVariants: Variants = {
    initial: { rotate: 0, scale: 1 },
    hover: { rotate: 5, scale: 1.1, transition: { duration: 0.3 } },
}

const linkVariants: Variants = {
    initial: { x: 0, opacity: 0.8 },
    hover: { x: 5, opacity: 1, transition: { duration: 0.3 } },
}

export function BentoGrid() {
    return (
        <section className="py-24 bg-gradient-to-b from-white to-slate-50 border-t">
            <div className="container mx-auto px-4 max-w-7xl">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-5xl font-headline font-bold tracking-tight mb-4"
                    >
                        Platform Features
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-xl text-slate-600 max-w-2xl mx-auto"
                    >
                        Everything you need to build verified communities
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

                    {/* 1. Telegram Auto-Verification (Large, 4 cols) */}
                    <motion.div
                        variants={cardVariants}
                        initial="initial"
                        whileHover="hover"
                        className="lg:col-span-4 rounded-3xl p-8 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 shadow-md relative overflow-hidden group cursor-pointer"
                    >
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-6">
                                <motion.div variants={iconVariants} className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-[#229ED9]">
                                    {/* Telegram SVG */}
                                    <svg width="32" height="32" viewBox="0 0 256 256" fill="currentColor">
                                        <path d="M216.85,55.77l-26.69,127.32c-2,9.66-8,12.06-16.27,7.5l-45-33.15-21.7,20.9a11.37,11.37,0,0,1-9.08,4.43l3.23-45.71L184.6,62.61c3.67-3.26-.8-5.06-5.7-2L71.37,128.59,27,114.71c-9.67-3-9.87-9.68,2-14.33L208.5,30.34C216.89,27.2,224.23,32.26,216.85,55.77Z"></path>
                                    </svg>
                                </motion.div>
                                <div className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                                    Most Popular
                                </div>
                            </div>

                            <motion.div variants={contentVariants} className="mt-auto">
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Telegram Auto-Verification</h3>
                                <p className="text-slate-600 mb-6 leading-relaxed">
                                    Seamlessly verify channel membership with our intelligent bot. Real-time tracking of joins and engagement.
                                </p>

                                <div className="flex items-center text-indigo-600 font-semibold text-sm">
                                    <span className="mr-2">Learn more</span>
                                    <motion.div variants={linkVariants}>
                                        <ArrowRight className="w-4 h-4" />
                                    </motion.div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors duration-500"></div>
                    </motion.div>


                    {/* 2. Discord Auto-Verification (Large, 4 cols) */}
                    <motion.div
                        variants={cardVariants}
                        initial="initial"
                        whileHover="hover"
                        className="lg:col-span-4 rounded-3xl p-8 bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-100 shadow-md relative overflow-hidden group cursor-pointer"
                    >
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-6">
                                <motion.div variants={iconVariants} className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-[#5865F2]">
                                    {/* Discord SVG */}
                                    <svg width="34" height="34" viewBox="0 0 127.14 96.36" fill="currentColor">
                                        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"></path>
                                    </svg>
                                </motion.div>
                            </div>

                            <motion.div variants={contentVariants} className="mt-auto">
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Discord Server Verification</h3>
                                <p className="text-slate-600 mb-6 leading-relaxed">
                                    Automatically verify server membership and track user engagement in real-time.
                                </p>

                                <div className="flex items-center text-blue-600 font-semibold text-sm">
                                    <span className="mr-2">Learn more</span>
                                    <motion.div variants={linkVariants}>
                                        <ArrowRight className="w-4 h-4" />
                                    </motion.div>
                                </div>
                            </motion.div>
                        </div>
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors duration-500"></div>
                    </motion.div>


                    {/* 3. Humanity Protocol (Large, 4 cols) */}
                    <motion.div
                        variants={cardVariants}
                        initial="initial"
                        whileHover="hover"
                        className="lg:col-span-4 rounded-3xl p-8 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 shadow-md relative overflow-hidden group cursor-pointer"
                    >
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-6">
                                <motion.div variants={iconVariants} className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center p-2">
                                    <Image
                                        src="/humanity_Logo_green.svg"
                                        alt="Humanity Protocol"
                                        width={48}
                                        height={48}
                                        className="object-contain"
                                    />
                                </motion.div>
                                <div className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                                    Enterprise
                                </div>
                            </div>

                            <motion.div variants={contentVariants} className="mt-auto">
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Sybil-Resistant Verification</h3>
                                <p className="text-slate-600 mb-6 leading-relaxed">
                                    Palm-scan biometric verification ensures every participant is a unique human. No bots, no fake accounts.
                                </p>

                                <div className="flex items-center text-emerald-600 font-semibold text-sm">
                                    <span className="mr-2">Learn more</span>
                                    <motion.div variants={linkVariants}>
                                        <ArrowRight className="w-4 h-4" />
                                    </motion.div>
                                </div>
                            </motion.div>
                        </div>
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors duration-500"></div>
                    </motion.div>


                    {/* 4. X402 Paywall (Medium, 6 cols) */}
                    <motion.div
                        variants={cardVariants}
                        initial="initial"
                        whileHover="hover"
                        className="lg:col-span-6 rounded-3xl p-8 bg-white border border-slate-100 shadow-md hover:shadow-xl relative overflow-hidden group cursor-pointer"
                    >
                        <div className="flex flex-col md:flex-row gap-6 items-start h-full">
                            <div className="flex-shrink-0">
                                <motion.div variants={iconVariants} className="w-12 h-12 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                                    <CreditCard className="w-6 h-6" />
                                </motion.div>
                            </div>
                            <div className="flex-grow">
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-xl font-bold text-slate-900">X 402 Paywall Integration</h3>
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-full">New</span>
                                </div>
                                <p className="text-slate-600 mb-3 text-sm leading-relaxed">
                                    Monetize exclusive community with crypto payments directly through X402 protocol.
                                </p>
                                <div className="flex items-center text-orange-500 font-medium text-sm">
                                    <span className="mr-1">Explore features</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>
                    </motion.div>


                    {/* 5. On-Chain Verification (Small, 3 cols) */}
                    <motion.div
                        variants={cardVariants}
                        initial="initial"
                        whileHover="hover"
                        className="lg:col-span-3 rounded-3xl p-6 bg-white border border-slate-100 shadow-md hover:shadow-xl relative overflow-hidden group cursor-pointer"
                    >
                        <motion.div variants={iconVariants} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center mb-4">
                            <LinkIcon className="w-5 h-5" />
                        </motion.div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Blockchain-Verified</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            All verifications recorded on-chain for transparency.
                        </p>
                    </motion.div>


                    {/* 6. Multi-Chain Support (Small, 3 cols) */}
                    <motion.div
                        variants={cardVariants}
                        initial="initial"
                        whileHover="hover"
                        className="lg:col-span-3 rounded-3xl p-6 bg-white border border-slate-100 shadow-md hover:shadow-xl relative overflow-hidden group cursor-pointer"
                    >
                        <motion.div variants={iconVariants} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center mb-4">
                            <Layers className="w-5 h-5" />
                        </motion.div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">10+ Chains</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            Ethereum, Polygon, Base, Arbitrum, Optimism & more.
                        </p>
                    </motion.div>

                </div>
            </div>
        </section>
    )
}
