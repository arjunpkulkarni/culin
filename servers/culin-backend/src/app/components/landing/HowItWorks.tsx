'use client';

import React from 'react';
import { content } from '@/lib/content';

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 border-b border-borderSoft">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="mb-16">
          <span className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen mb-4 block">
            {content.howItWorks.label}
          </span>
          <h2 className="text-5xl md:text-6xl text-culinText leading-tight">
            {content.howItWorks.title}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-borderSoft">
          {content.howItWorks.steps.map((step) => (
            <div
              key={step.number}
              className="relative bg-culinCard/50 backdrop-blur-sm p-10 md:p-12"
            >
              <div className="absolute top-0 left-0 w-0 h-0 border-t-[12px] border-t-culinGreen border-r-[12px] border-r-transparent" />
              <span className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen mb-6 block">
                Step {step.number}
              </span>
              <h3 className="text-2xl md:text-3xl text-culinText mb-4 leading-tight">
                {step.title}
              </h3>
              <p className="text-lg text-culinMuted leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
