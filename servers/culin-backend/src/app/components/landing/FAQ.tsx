'use client';

import React, { useState } from 'react';
import { content } from '@/lib/content';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="relative py-24 border-b border-borderSoft">
      <div className="max-w-[900px] mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16">
          <span className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen mb-4 block">
            07 — FAQs
          </span>
          <h2 className="text-5xl md:text-6xl text-culinText leading-tight">
            Questions
          </h2>
        </div>

        {/* Accordion */}
        <div className="space-y-px bg-borderSoft">
          {content.faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-culinCard/50 backdrop-blur-sm border-l-2 border-transparent hover:border-culinGreen transition-colors"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <span className="text-lg text-culinText pr-4">
                  {faq.question}
                </span>
                <svg
                  className={`w-5 h-5 text-culinGreen transition-transform flex-shrink-0 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-6">
                  <p className="text-culinMuted leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
