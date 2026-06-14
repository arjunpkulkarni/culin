'use client';

import React from 'react';
import { content } from '@/lib/content';

export default function WhoItsFor() {
  return (
    <section id="who-its-for" className="relative py-24 border-b border-borderSoft bg-culinCard/20">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="mb-16">
          <span className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen mb-4 block">
            {content.whoItsFor.label}
          </span>
          <h2 className="text-5xl md:text-6xl text-culinText leading-tight">
            {content.whoItsFor.title}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-borderSoft">
          {content.whoItsFor.audiences.map((audience, index) => (
            <div
              key={audience.title}
              className={`relative bg-culinCard/50 backdrop-blur-sm p-10 ${
                index === 0 ? 'lg:col-span-1' : ''
              }`}
            >
              <div className="absolute top-0 left-0 w-0 h-0 border-t-[12px] border-t-culinGreen border-r-[12px] border-r-transparent" />
              <h3 className="text-2xl text-culinText mb-3 leading-tight">
                {audience.title}
              </h3>
              <p className="text-culinMuted leading-relaxed">
                {audience.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
