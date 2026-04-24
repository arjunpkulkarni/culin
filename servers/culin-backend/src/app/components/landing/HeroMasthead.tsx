'use client';

import React, { useState } from 'react';
import { content } from '@/lib/content';

export default function HeroMasthead() {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle email submission
    console.log('Email submitted:', email);
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Content */}
      <div className="relative z-20 max-w-[1200px] mx-auto px-6 lg:px-8">
        {/* Announcement Bar - Centered */}
        <div className="mb-12 flex justify-center">
          <a
            href="#"
            className="group relative inline-flex items-center gap-2 px-4 py-2 border border-borderSoft rounded-full text-culinMuted hover:text-culinGreen transition-colors"
          >
            <span className="text-xs font-mono uppercase tracking-[0.16em]">
              {content.announcement.text}
            </span>
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {/* Corner triangle */}
            <div className="absolute -top-1 -right-1 w-0 h-0 border-t-[8px] border-t-culinGreen border-l-[8px] border-l-transparent"></div>
          </a>
        </div>

        {/* Hero Title - Centered */}
        <h1 className="text-[48px] sm:text-[64px] md:text-[88px] leading-[0.92] text-culinText mb-16 tracking-tight text-center">
          {content.hero.title}
        </h1>

        {/* Subtitle Sections - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 mb-16 max-w-[1000px] mx-auto">
          {/* Left Column */}
          <div className="space-y-6">
            <p className="text-xl md:text-2xl text-culinText leading-relaxed">
              Stop scrolling.
              <br />
              Start eating.
            </p>
            <p className="text-lg md:text-xl text-culinMuted leading-relaxed border-l-2 border-culinGreen pl-4">
              Culin decides your next meal in seconds — whether that means ordering from nearby restaurants or buying groceries to cook.
            </p>
          </div>

          {/* Right Column */}
          <div className="flex flex-col justify-center">
            <p className="text-2xl md:text-3xl text-culinGreen font-medium mb-4">
              One decision.
            </p>
            <p className="text-xl md:text-2xl text-culinText">
              Fastest path to food.
            </p>
          </div>
        </div>

        {/* Email CTA - Centered */}
        <div className="flex flex-col items-center">
          <form onSubmit={handleSubmit} className="max-w-md w-full mb-4">
            <div className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={content.hero.emailPlaceholder}
                className="flex-1 px-6 py-4 bg-culinCard/50 backdrop-blur border border-borderSoft rounded-full text-culinText placeholder:text-culinMuted/50 focus:outline-none focus:border-culinGreen transition-colors"
                required
              />
              <button
                type="submit"
                className="px-8 py-4 bg-white text-culinBg hover:bg-culinGreen hover:text-white rounded-full font-medium transition-all duration-200 whitespace-nowrap"
              >
                {content.hero.ctaPrimary}
              </button>
            </div>
          </form>

          {/* Helper text */}
          <p className="text-sm text-culinMuted/75 text-center">
            {content.hero.ctaHelper}
          </p>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
        <div className="w-6 h-10 border-2 border-borderSoft rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-3 bg-culinGreen rounded-full animate-bounce"></div>
        </div>
      </div>
    </section>
  );
}
