import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import Features from '@/components/landing/Features'
import HowItWorks from '@/components/landing/HowItWorks'
import BenefitsSection from '@/components/landing/BenefitsSection'
import CTASection from '@/components/landing/CTASection'
import Footer from '@/components/landing/Footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f6f2eb] text-slate-900">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <BenefitsSection />
      <CTASection />
      <Footer />
    </div>
  )
}
