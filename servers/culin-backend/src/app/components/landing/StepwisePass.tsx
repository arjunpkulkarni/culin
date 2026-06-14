'use client';

import React from 'react';
import { content } from '@/lib/content';

export default function StepwisePass() {
  return (
    <section className="relative py-24 border-b border-borderSoft">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen mb-4 block">
              {content.stepwisePass.label}
            </span>
            <h2 className="text-5xl md:text-6xl text-culinText mb-6 leading-tight">
              {content.stepwisePass.title}
            </h2>
            <p className="text-xl text-culinMuted leading-relaxed mb-10">
              {content.stepwisePass.description}
            </p>

            <div className="flex flex-wrap gap-3">
              {content.stepwisePass.dimensions.map((dim) => (
                <span
                  key={dim}
                  className="px-5 py-2.5 text-sm font-mono uppercase tracking-[0.12em] text-culinText border border-borderSoft rounded-full bg-culinCard/50"
                >
                  {dim}
                </span>
              ))}
            </div>
          </div>

          <div className="relative bg-culinCard/50 backdrop-blur-sm border border-borderSoft rounded-2xl p-10">
            <div className="absolute top-0 right-0 w-0 h-0 border-t-[16px] border-t-culinGreen border-l-[16px] border-l-transparent" />
            <p className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen mb-6">
              Balance check
            </p>
            <blockquote className="text-2xl md:text-3xl text-culinText leading-snug border-l-2 border-culinGreen pl-6">
              &ldquo;{content.stepwisePass.example}&rdquo;
            </blockquote>
          </div>
        </div>
      </div>
    </section>
  );
}
