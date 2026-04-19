import { Web3Provider } from '@/context/web3-provider';
import { WalletProvider } from '@/context/wallet-provider';
import { HumanityAuthProvider } from '@/context/humanity-provider';
import Header from '@/components/header';
import Footer from '@/components/footer';

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Web3Provider>
            <WalletProvider>
                <HumanityAuthProvider>
                    <Header />
                    <main className="flex-grow">{children}</main>
                    <Footer />
                </HumanityAuthProvider>
            </WalletProvider>
        </Web3Provider>
    );
}
