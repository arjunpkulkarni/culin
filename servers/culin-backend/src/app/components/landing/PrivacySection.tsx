'use client';

import React from 'react';
import { content } from '@/lib/content';

const iconMap: { [key: string]: string } = {
  lock: '🔒',
  shield: '🛡️',
  'eye-off': '👁️',
  trash: '🗑️'
};

export default function PrivacySection() {
  return (
    <section id="privacy" className="relative bg-culinCard py-24 border-b border-borderSoft">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen mb-4 block">
            02 — Security & Privacy
          </span>
          <h2 className="text-5xl md:text-6xl text-culinText mb-6 leading-tight">
            {content.privacy.title}
          </h2>
          <p className="text-xl text-culinMuted max-w-2xl mx-auto">
            {content.privacy.subtitle}
          </p>
        </div>

        {/* Privacy Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-borderSoft">
          {content.privacy.items.map((item, index) => (
            <div
              key={index}
              className="relative bg-culinBg p-8 hover:bg-culinDark transition-colors"
            >
              {/* Corner triangle on first item */}
              {index === 0 && (
                <div className="absolute top-0 left-0 w-0 h-0 border-t-[12px] border-t-culinGreen border-r-[12px] border-r-transparent"></div>
              )}

              <div className="text-4xl mb-4">{iconMap[item.icon]}</div>
              <h3 className="text-lg text-culinText font-medium">
                {item.title}
              </h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
