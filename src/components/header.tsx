
'use client';

import Link from 'next/link';
import { useWallet } from '@/context/wallet-provider';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Rocket, LogOut, PlusCircle, User, Wallet, Shield } from 'lucide-react';
import { truncateAddress } from '@/lib/utils';
import { Badge } from './ui/badge';

export default function Header() {
  const { isConnected, address, connectWallet, disconnectWallet, role, isSuperAdmin } = useWallet();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="flex items-center gap-2 mr-8">
          <Rocket className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Project Onboard</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm flex-1">
          {role === 'host' && (
            <Link href="/create-campaign" className='text-muted-foreground hover:text-foreground transition-colors'>
                Create Campaign
            </Link>
          )}
          {isSuperAdmin && (
             <Link href="/admin" className='text-muted-foreground hover:text-foreground transition-colors'>
                Admin Panel
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-4">
          {isConnected && address ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Wallet className="mr-2 h-4 w-4" />
                  {truncateAddress(address)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center justify-between">
                  My Wallet
                  <Badge variant="secondary">{role}</Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                 {role === 'host' && (
                  <DropdownMenuItem asChild className='cursor-pointer'>
                    <Link href="/create-campaign"><PlusCircle className="mr-2 h-4 w-4"/>Create Campaign</Link>
                  </DropdownMenuItem>
                 )}
                 {isSuperAdmin && (
                  <DropdownMenuItem asChild className='cursor-pointer'>
                     <Link href="/admin"><Shield className="mr-2 h-4 w-4" />Admin Panel</Link>
                  </DropdownMenuItem>
                 )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={disconnectWallet} className="cursor-pointer text-red-500 focus:text-red-500">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Disconnect</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={connectWallet} className='bg-primary text-primary-foreground hover:bg-primary/90'>
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
