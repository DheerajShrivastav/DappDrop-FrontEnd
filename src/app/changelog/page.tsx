
'use client';

import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitCommit, ShieldCheck, Zap, Bot } from 'lucide-react';

const changelogData = [
    {
        date: new Date('2024-07-28T10:00:00Z'),
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
        date: new Date('2024-07-27T14:30:00Z'),
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
    }
];

const ChangeTypeIcon = ({ type, icon: Icon }: { type: string; icon: React.ElementType }) => {
    const getBadgeVariant = () => {
        switch (type) {
            case 'Security': return 'destructive';
            case 'Feature': return 'default';
            case 'Improvement': return 'secondary';
            default: return 'outline';
        }
    }
    return (
        <Badge variant={getBadgeVariant()} className="mr-2">
            <Icon className="h-3 w-3 mr-1" />
            {type}
        </Badge>
    );
};

export default function ChangelogPage() {
    return (
        <div className="bg-background text-foreground">
            <section className="bg-card border-b border-primary/20">
                <div className="container mx-auto px-4 py-20 text-center">
                <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
                    Changelog
                </h1>
                <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
                    Stay updated with the latest features, improvements, and bug fixes for DApp Drop Zone.
                </p>
                </div>
            </section>

            <section className="py-20">
                <div className="container mx-auto px-4 max-w-4xl">
                   <div className="relative">
                        <div className="absolute left-4 top-0 h-full w-0.5 bg-border -translate-x-1/2" aria-hidden="true"></div>
                        <div className="space-y-12">
                            {changelogData.map((entry, index) => (
                                <div key={index} className="relative pl-8">
                                    <div className="absolute left-4 top-2 h-4 w-4 bg-primary rounded-full -translate-x-1/2 border-4 border-card"></div>
                                    <p className="text-sm text-muted-foreground font-medium mb-1">{format(entry.date, 'MMMM dd, yyyy')}</p>
                                    <Card className="bg-card border shadow-md">
                                        <CardHeader>
                                            <CardTitle className="text-2xl">{entry.title}</CardTitle>
                                            <CardDescription>{entry.description}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ul className="space-y-3">
                                                {entry.changes.map((change, cIndex) => (
                                                    <li key={cIndex} className="flex items-start">
                                                        <ChangeTypeIcon type={change.type} icon={change.icon} />
                                                        <span className="flex-1 text-muted-foreground">{change.text}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </CardContent>
                                    </Card>
                                </div>
                            ))}
                        </div>
                   </div>
                </div>
            </section>
        </div>
    );
}
