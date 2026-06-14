'use client';

import React from 'react';
import { content } from '@/lib/content';

export default function TeamSection() {
  return (
    <section id="team" className="relative py-24 border-b border-borderSoft">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="mb-16">
          <span className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen mb-4 block">
            {content.team.label}
          </span>
          <h2 className="text-5xl md:text-6xl text-culinText leading-tight mb-6">
            {content.team.title}
          </h2>
          <p className="text-lg text-culinMuted max-w-2xl">
            {content.team.credibility}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {content.team.members.map((member) => (
            <div
              key={member.name}
              className="relative bg-culinCard/50 backdrop-blur-sm border border-borderSoft rounded-2xl p-10"
            >
              <div className="absolute top-0 left-0 w-0 h-0 border-t-[12px] border-t-culinGreen border-r-[12px] border-r-transparent" />
              <h3 className="text-2xl md:text-3xl text-culinText mb-2">
                {member.name}
              </h3>
              <p className="text-sm font-mono uppercase tracking-[0.12em] text-culinGreen mb-4">
                {member.role}
              </p>
              <p className="text-culinMuted leading-relaxed">
                {member.bio}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
