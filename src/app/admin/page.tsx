
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ShieldCheck, Loader2, UserX } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useWallet } from '@/context/wallet-provider';
import { grantHostRole, getAllHosts, revokeHostRole } from '@/lib/web3-service';
import { truncateAddress } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const hostRoleSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address.'),
});

type HostRoleFormValues = z.infer<typeof hostRoleSchema>;

export default function AdminPage() {
  const [isGranting, setIsGranting] = useState(false);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [hosts, setHosts] = useState<string[]>([]);
  const { toast } = useToast();
  const { isConnected, isSuperAdmin } = useWallet();
  const router = useRouter();
  
  const fetchHosts = useCallback(async () => {
    const hostList = await getAllHosts();
    setHosts(hostList);
  }, []);

  useEffect(() => {
    if (!isConnected) {
        toast({
            variant: 'destructive',
            title: 'Unauthorized',
            description: 'Please connect your wallet to view this page.'
        });
      router.push('/');
      return;
    }
    if (!isSuperAdmin) {
         toast({
            variant: 'destructive',
            title: 'Unauthorized',
            description: 'You do not have permission to view this page.'
        });
      router.push('/');
    }
    if (isSuperAdmin) {
        fetchHosts();
    }
  }, [isConnected, isSuperAdmin, router, toast, fetchHosts]);


  const form = useForm<HostRoleFormValues>({
    resolver: zodResolver(hostRoleSchema),
    defaultValues: {
      address: '',
    },
    mode: 'onChange',
  });

  const onGrantSubmit = async (data: HostRoleFormValues) => {
    if (!isConnected) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please connect your wallet.' });
      return;
    }
    setIsGranting(true);
    try {
        await grantHostRole(data.address);
        form.reset();
        await fetchHosts(); 
    } catch(e) {
      // Error toast is handled in the web3-service
    } finally {
      setIsGranting(false);
    }
  };

  const onRevokeSubmit = async (hostAddress: string) => {
    if (!isConnected) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please connect your wallet.' });
      return;
    }
    setIsRevoking(hostAddress);
    try {
        await revokeHostRole(hostAddress);
        await fetchHosts();
    } catch (e) {
        // Error toast handled in service
    } finally {
        setIsRevoking(null);
    }
  }

  // Render a loading state or access denied message while checking role
  if (!isSuperAdmin) {
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Alert variant="destructive">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                    You are not authorized to view this page. Please connect as the contract administrator.
                </AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Card className="bg-card mb-8">
            <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Admin Panel</CardTitle>
            <CardDescription className="text-center">Grant Host Role to a New Address</CardDescription>
            </CardHeader>
            <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onGrantSubmit)} className="space-y-8">
                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Ethereum Address</FormLabel>
                        <FormControl>
                        <Input placeholder="0x..." {...field} />
                        </FormControl>
                        <FormDescription>
                        The address to be granted the HOST_ROLE.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button type="submit" disabled={isGranting || !isConnected} className="w-full">
                    {isGranting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Grant Host Role
                </Button>
                </form>
            </Form>
            </CardContent>
        </Card>

        <Card className="bg-card">
            <CardHeader>
                <CardTitle>Manage Existing Hosts</CardTitle>
                <CardDescription>Revoke HOST_ROLE from an address.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {hosts.length > 0 ? hosts.map((host) => (
                        <div key={host} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
                            <code className="text-sm font-mono">{host}</code>
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => onRevokeSubmit(host)}
                                disabled={isRevoking === host}
                            >
                                {isRevoking === host ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                                Revoke
                            </Button>
                        </div>
                    )) : <p className="text-muted-foreground text-center">No hosts found.</p>}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
