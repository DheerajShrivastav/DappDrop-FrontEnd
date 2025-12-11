'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Twitter,
    CreditCard,
    Bot,
    ShieldCheck,
    DollarSign,
    Image as ImageIcon,
    Award,
    Zap,
    Check,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type UseCase = {
    icon: React.ElementType
    title: string
    description: string
    color: string
}

const userUseCases: UseCase[] = [
    {
        icon: Twitter,
        title: 'Social Follows',
        description: 'Discover new projects and grow your community on X (Twitter).',
        color: 'text-sky-500',
    },
    {
        icon: CreditCard,
        title: 'X402 Paywall',
        description: 'Monetize exclusive community with crypto payments directly through X402 protocol.',
        color: 'text-orange-500',
    },
    {
        icon: Bot,
        title: 'Join Discord / Telegram',
        description: 'Get exclusive access to community channels and discussions.',
        color: 'text-indigo-500',
    },
    {
        icon: ShieldCheck,
        title: 'On-Chain Actions',
        description: 'Prove your wallet activity, token holds, and contract interactions.',
        color: 'text-emerald-500',
    },
]

const projectUseCases: UseCase[] = [
    {
        icon: ImageIcon,
        title: 'On-Chain NFTs',
        description: 'Reward loyal users with unique, verifiable digital collectibles (ERC721).',
        color: 'text-pink-500',
    },
    {
        icon: DollarSign,
        title: 'Cryptocurrency',
        description: 'Distribute your project native token or stablecoins (ERC20).',
        color: 'text-green-500',
    },
    {
        icon: Award,
        title: 'Exclusive Roles',
        description: 'Grant special Discord roles or access to token-gated content.',
        color: 'text-purple-500',
    },
    {
        icon: Zap,
        title: 'Custom Rewards',
        description: 'Design flexible reward structures tailored to your community goals.',
        color: 'text-orange-500',
    },
]

export function UseCasesTabs() {
    const [activeTab, setActiveTab] = useState<'users' | 'projects'>('users')

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Custom Tabs Trigger */}
            <div className="flex justify-center mb-12">
                <div className="bg-slate-100/80 p-1.5 rounded-full inline-flex relative">
                    {/* Slider Background */}
                    <motion.div
                        className="absolute bg-slate-900 rounded-full shadow-md top-1.5 bottom-1.5 z-0"
                        initial={false}
                        animate={{
                            left: activeTab === 'users' ? '6px' : '50%',
                            right: activeTab === 'users' ? '50%' : '6px'
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />

                    <button
                        onClick={() => setActiveTab('users')}
                        className={cn(
                            "relative px-8 py-3 rounded-full text-sm font-semibold transition-colors duration-200 z-10 min-w-[140px]",
                            activeTab === 'users' ? "text-white" : "text-slate-500 hover:text-slate-900"
                        )}
                    >
                        Tasks for Users
                    </button>
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={cn(
                            "relative px-8 py-3 rounded-full text-sm font-semibold transition-colors duration-200 z-10 min-w-[140px]",
                            activeTab === 'projects' ? "text-white" : "text-slate-500 hover:text-slate-900"
                        )}
                    >
                        Rewards for Projects
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="relative min-h-[400px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card className="border border-gray-100 shadow-xl shadow-purple-900/5 bg-white overflow-hidden">
                            <CardContent className="p-8">
                                <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
                                    {(activeTab === 'users' ? userUseCases : projectUseCases).map((item, index) => (
                                        <div key={index} className="flex gap-4 group">
                                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300",
                                                "bg-slate-50 group-hover:bg-slate-100",
                                                item.color
                                            )}>
                                                <item.icon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                                                    {item.title}
                                                    {activeTab === 'users' && index === 3 && (
                                                        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Verifiable</span>
                                                    )}
                                                </h4>
                                                <p className="text-sm text-slate-600 leading-relaxed">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Bottom Footer Area */}
                                <div className="mt-10 pt-8 border-t border-slate-100 flex justify-between items-center text-sm text-slate-500">
                                    <div className="flex gap-4">
                                        <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Free to start</span>
                                        <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> No coding required</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
