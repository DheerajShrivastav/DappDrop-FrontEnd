

"use client"

import { format } from 'date-fns'
import { GitCommit, ShieldCheck, Zap, Bot, UserPlus, Rocket } from 'lucide-react'
import Navbar from '@/components/landing/Navbar'

const changelogData = [
    {
        date: new Date('2025-08-31T10:00:00Z'),
        version: 'Phase 1 Launch',
        title: 'Smart Contract Security Upgrade',
        description: 'Deployed Phase 1 of our smart contract with critical security upgrades to lay the foundation for a scalable, secure Web3 campaign platform.',
        changes: [
            {
                type: 'Security',
                icon: ShieldCheck,
                text: 'Integrated ReentrancyGuard and Pausable contracts for enhanced attack resistance.',
            },
            {
                type: 'Feature',
                icon: Zap,
                text: 'Implemented robust role-based access control (RBAC) with distinct HOST and ADMIN roles.',
            },
             {
                type: 'Improvement',
                icon: GitCommit,
                text: 'Added campaign timeframe enforcement to ensure task validity and prevent out-of-bounds interactions.',
            },
            {
                type: 'Improvement',
                icon: GitCommit,
                text: 'Integrated rate-limiting mechanisms to protect against spam and abuse.',
            },
        ],
    },
    {
        date: new Date('2025-08-13T14:30:00Z'),
        version: 'Feature Update',
        title: 'AI-Powered Campaign Generation',
        description: 'Introduced a new feature allowing hosts to generate complete campaign drafts using AI, streamlining the creation process.',
        changes: [
            {
                type: 'Feature',
                icon: Bot,
                text: 'Added a new Genkit flow to generate campaign titles, descriptions, and tasks from a simple text prompt.',
            },
            {
                type: 'Feature',
                icon: Zap,
                text: 'Integrated an AI generation UI into the "Create Campaign" page to autofill the form for hosts.',
            },
        ],
    },
    {
        date: new Date('2025-08-05T18:00:00Z'),
        version: 'Governance Update',
        title: 'Permissionless Host Role',
        description: 'Decentralized campaign creation by allowing any user to grant themselves the HOST_ROLE directly via a smart contract interaction.',
        changes: [
            {
                type: 'Feature',
                icon: UserPlus,
                text: 'Users can now self-assign the HOST_ROLE on the "Create Campaign" page without needing admin approval.',
            },
            {
                type: 'Improvement',
                icon: GitCommit,
                text: 'This change removes a centralized bottleneck, empowering the community to create campaigns freely and fostering a more open platform.',
            },
        ],
    },
    {
        date: new Date('2025-08-02T12:00:00Z'),
        version: 'Initial Launch',
        title: 'DApp Drop Zone v1.0 Launch',
        description: 'The first version of DApp Drop Zone is live, introducing the core functionalities for creating, managing, and participating in Web3 campaigns.',
        changes: [
            {
                type: 'Feature',
                icon: Rocket,
                text: 'Hosts can create, manage, and add tasks to on-chain campaigns.',
            },
            {
                type: 'Feature',
                icon: UserPlus,
                text: 'Participants can join campaigns, complete tasks, and track their progress.',
            },
            {
                type: 'Feature',
                icon: GitCommit,
                text: 'Added a host dashboard with analytics to monitor participant engagement.',
            },
        ],
    }
]

const badgeTone = (type: string) => {
    switch (type) {
        case 'Security':
            return 'bg-rose-100 text-rose-700'
        case 'Feature':
            return 'bg-sky-100 text-sky-700'
        case 'Improvement':
            return 'bg-slate-100 text-slate-700'
        case 'Governance':
            return 'bg-indigo-100 text-indigo-700'
        default:
            return 'bg-slate-100 text-slate-700'
    }
}

export default function ChangelogPage() {
    const sortedChangelogData = changelogData
        .slice()
        .sort((a, b) => b.date.getTime() - a.date.getTime())

    return (
        <div className="bg-[#f6f2eb] text-slate-900">
            <Navbar />
            <section className="relative overflow-hidden px-6 pb-24 pt-28">
                <div className="absolute inset-x-16 top-16 h-48 rounded-3xl bg-gradient-to-r from-sky-200/60 via-blue-100/50 to-indigo-200/60 blur-3xl" />
                <div className="relative mx-auto max-w-4xl text-center">
                    <span className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 shadow-sm">
                        Build log
                    </span>
                    <h1 className="mt-8 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                        Every release moves DAppDrop closer to verifiable, human growth.
                    </h1>
                    <p className="mt-6 text-lg text-slate-600 sm:text-xl">
                        Follow along as we ship infrastructure for campaign teams, participants, and the operators who connect them.
                    </p>
                </div>

                <div className="relative mx-auto mt-16 max-w-5xl rounded-3xl border border-white/60 bg-white/80 p-10 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur">
                    <div className="grid gap-6 sm:grid-cols-3">
                        {[
                            { label: 'Latest milestone', value: sortedChangelogData[0]?.version ?? '—' },
                            { label: 'Total releases tracked', value: sortedChangelogData.length.toString() },
                            { label: 'Contract upgrades', value: sortedChangelogData.filter((entry) => entry.title.toLowerCase().includes('contract')).length.toString() },
                        ].map((item) => (
                            <div key={item.label} className="rounded-2xl border border-slate-200/80 bg-white/70 px-5 py-4 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                                <p className="mt-2 text-lg font-semibold text-slate-900">{item.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="relative px-6 pb-32">
                <div className="absolute inset-x-12 top-0 h-72 rounded-3xl bg-gradient-to-b from-white/80 via-white/40 to-transparent blur-3xl" />
                <div className="relative mx-auto max-w-5xl">
                    <div className="flex flex-col gap-10 before:absolute before:left-1/2 before:top-6 before:h-[calc(100%-3rem)] before:w-px before:-translate-x-1/2 before:bg-gradient-to-b before:from-sky-200 before:via-slate-200 before:to-transparent md:before:left-6 md:before:translate-x-0">
                        {sortedChangelogData.map((entry, index) => (
                            <div
                                key={entry.title}
                                className="relative grid gap-6 rounded-3xl border border-white/60 bg-white/80 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur md:grid-cols-[200px,1fr]"
                            >
                                <div className="flex flex-col gap-4 md:items-start">
                                    <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                                        {format(entry.date, 'MMM dd, yyyy')}
                                    </div>
                                    <p className="text-base font-semibold text-slate-700">{entry.version}</p>
                                </div>

                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900">{entry.title}</h2>
                                    <p className="mt-2 text-sm text-slate-600">{entry.description}</p>
                                    <ul className="mt-6 space-y-3 text-sm text-slate-600">
                                        {entry.changes.map((change, changeIndex) => {
                                            const Icon = change.icon
                                            return (
                                                <li key={changeIndex} className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm">
                                                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badgeTone(change.type)}`}>
                                                        <Icon className="h-3.5 w-3.5" />
                                                        {change.type}
                                                    </span>
                                                    <span className="flex-1 leading-relaxed">{change.text}</span>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </div>

                                <span className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-white/70 bg-gradient-to-br from-sky-400 to-indigo-400 p-2 text-white shadow-lg md:left-6 md:translate-x-0">
                                    <Rocket className="h-4 w-4" />
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}

