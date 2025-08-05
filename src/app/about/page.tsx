
'use client';

import { CheckCircle, Gift, PlusCircle, Rocket, Users, Zap, ShieldCheck, ShieldOff, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AboutPage() {
  return (
    <div className="bg-background text-foreground">
      <section className="bg-card border-b border-primary/20">
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
            About DApp Drop Zone
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
            Our mission is to provide a decentralized, transparent, and engaging platform that connects innovative Web3 projects with genuine, active users, fostering real community growth and rewarding participation.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-2 gap-12">
            
            {/* For Project Hosts */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold text-center text-primary flex items-center justify-center gap-2"><Rocket className="h-6 w-6" /> For Project Hosts</h3>
              <div className="space-y-4">
                <Card className="bg-card border">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-full font-bold text-lg">1</div>
                      <div>
                        <CardTitle className="text-xl">Create Your Campaign</CardTitle>
                        <p className="text-muted-foreground">Use our intuitive step-by-step form to define your campaign details, from the title and description to the duration and branding.</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                 <Card className="bg-card border">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-full font-bold text-lg">2</div>
                      <div>
                        <CardTitle className="text-xl">Add Engaging Tasks</CardTitle>
                        <p className="text-muted-foreground">Design a series of on-chain or off-chain tasks for participants to complete, such as following on social media or interacting with a smart contract.</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                 <Card className="bg-card border">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-full font-bold text-lg">3</div>
                      <div>
                        <CardTitle className="text-xl">Set the Rewards</CardTitle>
                        <p className="text-muted-foreground">Define the rewards for completion. Distribute ERC20 tokens, mint exclusive NFTs, or provide other unique off-chain benefits.</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                 <Card className="bg-card border">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-full font-bold text-lg">4</div>
                      <div>
                        <CardTitle className="text-xl">Launch &amp; Grow</CardTitle>
                        <p className="text-muted-foreground">Open your campaign to the public from your dashboard and watch your community grow as users participate and complete tasks.</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            </div>

            {/* For Participants */}
            <div className="space-y-8">
              <h3 className="text-2xl font-semibold text-center text-primary flex items-center justify-center gap-2"><Users className="h-6 w-6" /> For Participants</h3>
               <div className="space-y-4">
                <Card className="bg-card border">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-full font-bold text-lg">1</div>
                      <div>
                        <CardTitle className="text-xl">Discover New Projects</CardTitle>
                        <p className="text-muted-foreground">Browse active campaigns on our platform to find the latest and most exciting projects in the Web3 space.</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                 <Card className="bg-card border">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-full font-bold text-lg">2</div>
                      <div>
                        <CardTitle className="text-xl">Complete Tasks</CardTitle>
                        <p className="text-muted-foreground">Connect your wallet and complete the tasks listed for a campaign. Your progress is tracked on-chain for transparency.</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                 <Card className="bg-card border">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-full font-bold text-lg">3</div>
                      <div>
                        <CardTitle className="text-xl">Claim Your Rewards</CardTitle>
                        <p className="text-muted-foreground">Once all required tasks are done and the campaign has ended, you can claim your rewards directly to your wallet.</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                 <Card className="bg-card border">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-full font-bold text-lg">4</div>
                      <div>
                        <CardTitle className="text-xl">Join a Community</CardTitle>
                        <p className="text-muted-foreground">By participating, you become an early member of a new project's community, with the potential for future benefits and access.</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

       <section className="py-20 bg-card border-t">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Beyond the Form: Why On-Chain Engagement Matters</h2>
            <p className="text-muted-foreground mb-12">
              Tired of sifting through thousands of bot entries from a Google Form? DApp Drop Zone leverages the power of the blockchain to ensure every participant is genuine and every action is verifiable.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="bg-background border-destructive/30">
              <CardHeader>
                <div className="flex items-center gap-4">
                    <ShieldOff className="h-10 w-10 text-destructive" />
                    <div>
                        <CardTitle className="text-2xl">The Old Way: Forms &amp; Bots</CardTitle>
                        <CardDescription>Manual, inefficient, and vulnerable to spam.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Bot className="h-5 w-5 mt-1 shrink-0" />
                  <p><strong className="text-foreground">Bot Magnet:</strong> Simple forms are easily spammed by bots, creating thousands of fake entries and making it impossible to find real users.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Bot className="h-5 w-5 mt-1 shrink-0" />
                   <p><strong className="text-foreground">Manual Verification Hell:</strong> Hosts spend countless hours trying to manually verify social follows or other tasks, often with unreliable results.</p>
                </div>
                 <div className="flex items-start gap-3">
                  <Bot className="h-5 w-5 mt-1 shrink-0" />
                   <p><strong className="text-foreground">No Real Engagement:</strong> Participants just fill out a form. There's no meaningful interaction with your project or its on-chain assets.</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-background border-primary/30">
              <CardHeader>
                <div className="flex items-center gap-4">
                    <ShieldCheck className="h-10 w-10 text-primary" />
                    <div>
                        <CardTitle className="text-2xl">The New Way: DApp Drop Zone</CardTitle>
                        <CardDescription>Automated, transparent, and bot-resistant.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 mt-1 shrink-0 text-primary" />
                  <p><strong className="text-foreground">Verifiable On-Chain Actions:</strong> Tasks are completed and verified directly through smart contracts, proving genuine participation.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 mt-1 shrink-0 text-primary" />
                   <p><strong className="text-foreground">Automated &amp; Trustless:</strong> The smart contract handles everything from task validation to reward distribution, eliminating manual work and bias.</p>
                </div>
                 <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 mt-1 shrink-0 text-primary" />
                   <p><strong className="text-foreground">Sybil Resistant:</strong> Requiring a wallet connection and on-chain interactions naturally filters out low-effort bots and ensures a higher quality audience.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold tracking-tight text-center mb-12">Core Features</h2>
            <div className="grid md:grid-cols-3 gap-8 text-center max-w-5xl mx-auto">
                <div className="flex flex-col items-center p-6 bg-card rounded-lg">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <Zap className="h-8 w-8 text-primary"/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Decentralized &amp; Transparent</h3>
                    <p className="text-muted-foreground">All campaign logic, participation data, and reward distributions are handled by smart contracts on the Sepolia testnet, ensuring fairness and transparency.</p>
                </div>
                <div className="flex flex-col items-center p-6 bg-card rounded-lg">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <PlusCircle className="h-8 w-8 text-primary"/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Flexible Campaign Creation</h3>
                    <p className="text-muted-foreground">Hosts can easily create custom campaigns with a variety of on-chain and off-chain tasks to suit their project's specific engagement goals.</p>
                </div>
                 <div className="flex flex-col items-center p-6 bg-card rounded-lg">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                        <Gift className="h-8 w-8 text-primary"/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Verifiable On-Chain Rewards</h3>
                    <p className="text-muted-foreground">Reward your community with tangible, on-chain assets like ERC20 tokens or unique ERC721 NFTs, all handled securely through the smart contract.</p>
                </div>
            </div>
        </div>
      </section>
    </div>
  );
}

    