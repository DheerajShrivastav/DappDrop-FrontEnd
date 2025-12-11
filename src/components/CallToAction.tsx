'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { PlusCircle } from 'lucide-react'

export function CallToAction() {
    return (
        <section className="relative py-24 overflow-hidden">
            {/* Background with Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-black z-0"></div>
            {/* Texture Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0 pointer-events-none"></div>

            {/* Abstract Shapes/Glow */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-40">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/30 rounded-full blur-[120px]"></div>
            </div>

            <div className="container relative z-10 mx-auto px-4 text-center">
                <motion.h2
                    className="text-4xl md:text-5xl font-headline font-bold text-white mb-6 tracking-tight"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    Ready to Launch?
                </motion.h2>

                <motion.p
                    className="text-xl text-slate-300 max-w-2xl mx-auto mb-10"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                >
                    Join 500+ communities growing on-chain. Create your first campaign in minutes and start rewarding genuine engagement.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                >
                    <Button
                        size="lg"
                        asChild
                        className="bg-white text-slate-900 hover:bg-slate-100 hover:text-primary shadow-lg hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] h-14 px-10 text-lg font-bold rounded-xl transition-all duration-300 transform hover:scale-105"
                    >
                        <Link href="/create-campaign">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            Create Campaign
                        </Link>
                    </Button>
                </motion.div>
            </div>
        </section>
    )
}
