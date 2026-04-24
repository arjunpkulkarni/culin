'use client';

import React, { useState } from 'react';
import { content } from '@/lib/content';

export default function FeaturesTabs() {
  const [activeTab, setActiveTab] = useState('restaurant');

  return (
    <section id="features" className="relative bg-culinBg border-b border-borderSoft">
      {/* Sticky Tabs */}
      <div className="sticky top-[70px] z-40 bg-culinBg/95 backdrop-blur-xl border-b border-borderSoft">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
          <div className="flex overflow-x-auto scrollbar-hide">
            {content.featureTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-sm font-mono uppercase tracking-[0.12em] whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'text-culinGreen border-culinGreen'
                    : 'text-culinMuted border-transparent hover:text-culinText'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Content */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-24">
        {Object.entries(content.features).map(([key, feature]) => (
          <div
            key={key}
            className={`${
              activeTab === key ? 'block' : 'hidden'
            } grid grid-cols-1 lg:grid-cols-2 gap-12 items-center`}
          >
            {/* Left: Copy */}
            <div>
              <span className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen mb-4 block">
                02 — What Culin Does
              </span>
              <h2 className="text-5xl md:text-6xl text-culinText mb-6 leading-tight">
                {feature.title}
              </h2>
              <p className="text-xl text-culinMuted leading-relaxed">
                {feature.description}
              </p>
            </div>

            {/* Right: Media Placeholder */}
            <div className="relative aspect-[4/3] bg-culinCard border border-borderSoft rounded-2xl overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-6xl opacity-20">📱</div>
              </div>
              {/* Corner triangle */}
              <div className="absolute top-0 right-0 w-0 h-0 border-t-[16px] border-t-culinGreen border-l-[16px] border-l-transparent"></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
