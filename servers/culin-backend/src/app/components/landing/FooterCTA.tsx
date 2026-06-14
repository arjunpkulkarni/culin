'use client';

import React from 'react';
import { content } from '@/lib/content';

export default function FooterCTA() {
  return (
    <section className="relative bg-culinCard/30 backdrop-blur-sm py-20">
      <footer className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
          <div>
            <p className="text-2xl text-culinText mb-2">
              Culin<span className="text-culinGreen">AI</span>
            </p>
            <p className="text-culinMuted max-w-md">
              {content.footerCta.title}
            </p>
          </div>
          <a
            href="mailto:info.culinai@gmail.com"
            className="px-8 py-3 border-2 border-borderSoft text-culinText hover:border-culinGreen hover:text-culinGreen rounded-full font-medium transition-all duration-200"
          >
            {content.footerCta.ctaSecondary}
          </a>
        </div>

        <div className="pt-8 border-t border-borderSoft flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-culinMuted text-sm">
            © 2026 CulinAI. All rights reserved.
          </div>
          <div className="flex items-center gap-8">
            <a href="mailto:info.culinai@gmail.com" className="text-culinMuted hover:text-culinGreen transition-colors text-sm">
              info.culinai@gmail.com
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
