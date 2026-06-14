'use client';

import React from 'react';
import { content } from '@/lib/content';

export default function HeroMasthead() {
  const scrollToDemo = () => {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-[70px]">
      <div className="relative z-20 max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="mb-10 flex justify-center">
          <a
            href={content.announcement.link}
            className="group relative inline-flex items-center gap-2 px-4 py-2 border border-borderSoft rounded-full text-culinMuted hover:text-culinGreen transition-colors"
          >
            <span className="text-xs font-mono uppercase tracking-[0.16em]">
              {content.announcement.text}
            </span>
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <div className="absolute -top-1 -right-1 w-0 h-0 border-t-[8px] border-t-culinGreen border-l-[8px] border-l-transparent" />
          </a>
        </div>

        <p className="text-sm font-mono uppercase tracking-[0.2em] text-culinGreen text-center mb-6">
          {content.hero.tagline}
        </p>

        <h1 className="text-[42px] sm:text-[56px] md:text-[72px] leading-[0.95] text-culinText mb-8 tracking-tight text-center max-w-[900px] mx-auto">
          {content.hero.title}
        </h1>

        <p className="text-lg md:text-xl text-culinMuted leading-relaxed text-center max-w-[720px] mx-auto mb-10">
          {content.hero.subtitle}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          {content.hero.positioning.map((line) => (
            <span
              key={line}
              className="px-4 py-2 text-sm text-culinMuted border border-borderSoft rounded-full bg-culinCard/30"
            >
              {line}
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
          <button
            onClick={scrollToDemo}
            className="px-10 py-4 bg-white text-culinBg hover:bg-culinGreen hover:text-white rounded-full font-medium transition-all duration-200 text-lg"
          >
            {content.hero.ctaPrimary}
          </button>
          <button
            onClick={scrollToDemo}
            className="px-10 py-4 border-2 border-borderSoft text-culinText hover:border-culinGreen hover:text-culinGreen rounded-full font-medium transition-all duration-200 text-lg"
          >
            {content.hero.ctaSecondary}
          </button>
        </div>

        <p className="text-sm text-culinMuted/75 text-center">
          {content.hero.ctaHelper}
        </p>
      </div>

      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
        <div className="w-6 h-10 border-2 border-borderSoft rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-3 bg-culinGreen rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}
