
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
import { Gem, LogOut, PlusCircle, User, Wallet, Shield } from 'lucide-react';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { truncateAddress } from '@/lib/utils';

export default function Header() {
  const { isConnected, address, connectWallet, disconnectWallet, role, toggleRole, isSuperAdmin } = useWallet();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="flex items-center gap-2 mr-8">
          <Gem className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">DApp Drop Zone</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm flex-1">
          {role === 'host' && (
            <Button variant="ghost" asChild>
              <Link href="/create-campaign">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Campaign
              </Link>
            </Button>
          )}
          {isSuperAdmin && (
            <Button variant="ghost" asChild>
                <Link href="/admin">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                </Link>
            </Button>
          )}
        </nav>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="role-switch" className="text-sm font-medium">
              Participant
            </Label>
            <Switch
              id="role-switch"
              checked={role === 'host'}
              onCheckedChange={toggleRole}
              aria-label="Toggle between participant and host roles"
            />
            <Label htmlFor="role-switch" className="text-sm font-medium">
              Host
            </Label>
          </div>
          {isConnected && address ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Wallet className="mr-2 h-4 w-4" />
                  {truncateAddress(address)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>My Wallet</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={disconnectWallet} className="cursor-pointer text-red-500 focus:text-red-500">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Disconnect</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={connectWallet}>
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
