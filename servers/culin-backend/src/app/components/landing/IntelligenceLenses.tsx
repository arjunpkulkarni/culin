'use client';

import React from 'react';
import { content } from '@/lib/content';

const icons: Record<string, React.ReactNode> = {
  flask: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.59-.659L5 14.5m14 0V17a2 2 0 01-2 2H7a2 2 0 01-2-2v-2.5" />
    </svg>
  ),
  globe: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.105.178-2.17.511-3.162" />
    </svg>
  ),
  data: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-2.25v3.75" />
    </svg>
  ),
};

export default function IntelligenceLenses() {
  return (
    <section id="intelligence" className="relative py-24 border-b border-borderSoft bg-culinCard/20">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="mb-16">
          <span className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen mb-4 block">
            {content.intelligenceLenses.label}
          </span>
          <h2 className="text-5xl md:text-6xl text-culinText leading-tight">
            {content.intelligenceLenses.title}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {content.intelligenceLenses.lenses.map((lens) => (
            <div
              key={lens.title}
              className="relative bg-culinCard/50 backdrop-blur-sm border border-borderSoft rounded-2xl p-10"
            >
              <div className="text-culinGreen mb-6">{icons[lens.icon]}</div>
              <h3 className="text-2xl md:text-3xl text-culinText mb-4 leading-tight">
                {lens.title}
              </h3>
              <p className="text-lg text-culinMuted leading-relaxed">
                {lens.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
