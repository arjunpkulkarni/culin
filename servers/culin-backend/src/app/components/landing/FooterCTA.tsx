'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { content } from '@/lib/content';

export default function FooterCTA() {
  const router = useRouter();

  return (
    <section className="relative bg-culinCard/30 backdrop-blur-sm py-32">
      <div className="max-w-[1100px] mx-auto px-6 lg:px-8 text-center">
        {/* Title */}
        <h2 className="text-[48px] sm:text-[64px] md:text-[72px] leading-[0.95] text-culinText mb-4">
          {content.footerCta.title}
        </h2>
        
        {/* Subtitle */}
        <p className="text-xl text-culinMuted mb-12">
          {content.footerCta.subtitle}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => router.push('/chat')}
            className="px-10 py-4 bg-white text-culinBg hover:bg-culinGreen hover:text-white rounded-full font-medium transition-all duration-200 text-lg"
          >
            {content.footerCta.ctaPrimary}
          </button>
          <a
            href="mailto:info.culinai@gmail.com"
            className="px-10 py-4 border-2 border-borderSoft text-culinText hover:border-culinGreen hover:text-culinGreen rounded-full font-medium transition-all duration-200 text-lg"
          >
            {content.footerCta.ctaSecondary}
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-[1400px] mx-auto px-6 lg:px-8 mt-32 pt-12 border-t border-borderSoft">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-culinMuted text-sm">
            © 2026 Culin. All rights reserved.
          </div>
          <div className="flex items-center gap-8">
            <a href="mailto:hello@culin.ai" className="text-culinMuted hover:text-culinGreen transition-colors text-sm">
              Contact
            </a>
            <a href="#" className="text-culinMuted hover:text-culinGreen transition-colors text-sm">
              Privacy
            </a>
            <a href="#" className="text-culinMuted hover:text-culinGreen transition-colors text-sm">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </section>
  );
}
