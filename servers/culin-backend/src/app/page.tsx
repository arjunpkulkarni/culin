import LandingHeader from './components/landing/LandingHeader';
import HeroMasthead from './components/landing/HeroMasthead';
import MarqueeStrip from './components/landing/MarqueeStrip';
import ValueGrid from './components/landing/ValueGrid';
import FAQ from './components/landing/FAQ';
import FooterCTA from './components/landing/FooterCTA';

export default function Home() {
  return (
    <div className="min-h-screen bg-culinBg text-culinText relative">
      {/* Global Radial Gradient Background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Dark to light green radial gradient - stronger */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#064e3b_0%,#065f46_25%,#047857_50%,#059669_75%,#10b981_100%)] opacity-50"></div>
        {/* Overlay for blending with dark background */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-culinBg/30 to-culinBg/70"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <LandingHeader />
        <main>
          <HeroMasthead />
          <MarqueeStrip />
          <ValueGrid />
          <FAQ />
          <FooterCTA />
        </main>
      </div>
    </div>
  );
}
