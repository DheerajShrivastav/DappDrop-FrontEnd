import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import SignalStrip from '@/components/landing/SignalStrip'
import Features from '@/components/landing/Features'
import CampaignSpotlight from '@/components/landing/CampaignSpotlight'
import HowItWorks from '@/components/landing/HowItWorks'
import BenefitsSection from '@/components/landing/BenefitsSection'
import Testimonials from '@/components/landing/Testimonials'
import CTASection from '@/components/landing/CTASection'
import Footer from '@/components/landing/Footer'

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f2eb] text-slate-900">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-sky-200/60 via-slate-100/60 to-transparent" />
        <div className="absolute -left-32 top-64 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute -right-24 top-96 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute left-1/2 top-[680px] h-64 w-[60%] -translate-x-1/2 rounded-[120px] bg-gradient-to-r from-white/40 via-blue-100/30 to-white/40 blur-2xl" />
      </div>

      <Navbar />
      <Hero />
      <SignalStrip />
      <Features />
      <CampaignSpotlight />
      <HowItWorks />
      <BenefitsSection />
      <Testimonials />
      <CTASection />
      <Footer />
    </div>
  )
}
