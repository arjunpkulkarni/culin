'use client';

import React from 'react';
import { content } from '@/lib/content';

export default function ValueGrid() {
  return (
    <section className="relative py-24 border-b border-borderSoft">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        {/* Section number */}
        <div className="mb-12">
          <span className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen">
            01 — Why Culin
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-borderSoft">
          {content.valueGrid.map((item, index) => (
            <div
              key={index}
              className={`relative bg-culinCard/50 backdrop-blur-sm p-12 ${
                item.wide ? 'md:col-span-2' : ''
              }`}
            >
              {/* Corner triangle */}
              <div className="absolute top-0 left-0 w-0 h-0 border-t-[12px] border-t-culinGreen border-r-[12px] border-r-transparent"></div>

              <div className="max-w-2xl">
                <h3 className="text-3xl md:text-4xl text-culinText mb-4 leading-tight">
                  {item.title}
                </h3>
                <p className="text-lg text-culinMuted leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
