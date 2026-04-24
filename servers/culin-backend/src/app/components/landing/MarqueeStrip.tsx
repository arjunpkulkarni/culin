'use client';

import React from 'react';
import { content } from '@/lib/content';

export default function MarqueeStrip() {
  // Double the array for seamless loop
  const items = [...content.ticker, ...content.ticker];

  return (
    <div className="relative bg-culinCard/30 backdrop-blur-sm border-y border-borderSoft overflow-hidden py-6">
      {/* Gradient masks */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-culinCard/30 to-transparent z-10"></div>
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-culinCard/30 to-transparent z-10"></div>

      {/* Marquee */}
      <div className="flex animate-marquee">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-4 px-8 whitespace-nowrap"
          >
            <span className="text-sm font-mono uppercase tracking-[0.16em] text-culinMuted">
              {item}
            </span>
            <div className="w-1 h-1 bg-culinGreen rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
