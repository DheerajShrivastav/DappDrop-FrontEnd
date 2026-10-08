import { MotionConfig } from 'framer-motion';
import { Toaster } from '@/components/ui/toaster';
import { AppFonts } from '@/app/_fonts/app-fonts';
import { Web3Provider } from '@/context/web3-provider';
import { WalletProvider } from '@/context/wallet-provider';
import { HumanityAuthProvider } from '@/context/humanity-provider';
import Header from '@/components/header';
import Footer from '@/components/footer-app';

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <AppFonts />
            {/* Global reduced-motion gate: every framer-motion animation in the app
                automatically collapses to instant when the user prefers reduced motion,
                without needing to thread useReducedMotion() through each component.
                (Moved here from the root layout so the landing page ships no framer-motion.) */}
            <MotionConfig reducedMotion="user">
                <Web3Provider>
                    <WalletProvider>
                        <HumanityAuthProvider>
                            <Header />
                            <main className="flex-grow">{children}</main>
                            <Footer />
                        </HumanityAuthProvider>
                    </WalletProvider>
                </Web3Provider>
            </MotionConfig>
            <Toaster />
        </>
    );
}
