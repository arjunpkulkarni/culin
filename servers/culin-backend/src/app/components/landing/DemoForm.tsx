'use client';

import React, { useState } from 'react';
import { content } from '@/lib/content';

type FormData = {
  name: string;
  email: string;
  company: string;
  role: string;
  building: string;
};

const initialForm: FormData = {
  name: '',
  email: '',
  company: '',
  role: '',
  building: '',
};

export default function DemoForm() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [intent, setIntent] = useState<'demo' | 'waitlist'>('demo');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Demo request:', { intent, ...form });
    setSubmitted(true);
  };

  return (
    <section id="demo" className="relative py-24 border-b border-borderSoft bg-culinCard/20">
      <div className="max-w-[700px] mx-auto px-6 lg:px-8">
        <div className="mb-12 text-center">
          <span className="text-xs font-mono uppercase tracking-[0.16em] text-culinGreen mb-4 block">
            {content.demoForm.label}
          </span>
          <h2 className="text-5xl md:text-6xl text-culinText leading-tight mb-4">
            {content.demoForm.title}
          </h2>
          <p className="text-xl text-culinMuted">
            {content.demoForm.subtitle}
          </p>
        </div>

        {submitted ? (
          <div className="text-center py-16 bg-culinCard/50 border border-borderSoft rounded-2xl">
            <p className="text-2xl text-culinText mb-2">
              {content.demoForm.successMessage}
            </p>
            <p className="text-culinMuted">
              {content.hero.ctaHelper}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="name" className="block text-sm text-culinMuted mb-2">
                  {content.demoForm.fields.name}
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-5 py-3.5 bg-culinCard/50 backdrop-blur border border-borderSoft rounded-xl text-culinText placeholder:text-culinMuted/50 focus:outline-none focus:border-culinGreen transition-colors"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm text-culinMuted mb-2">
                  {content.demoForm.fields.email}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-5 py-3.5 bg-culinCard/50 backdrop-blur border border-borderSoft rounded-xl text-culinText placeholder:text-culinMuted/50 focus:outline-none focus:border-culinGreen transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="company" className="block text-sm text-culinMuted mb-2">
                  {content.demoForm.fields.company}
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  required
                  value={form.company}
                  onChange={handleChange}
                  className="w-full px-5 py-3.5 bg-culinCard/50 backdrop-blur border border-borderSoft rounded-xl text-culinText placeholder:text-culinMuted/50 focus:outline-none focus:border-culinGreen transition-colors"
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm text-culinMuted mb-2">
                  {content.demoForm.fields.role}
                </label>
                <input
                  id="role"
                  name="role"
                  type="text"
                  required
                  value={form.role}
                  onChange={handleChange}
                  className="w-full px-5 py-3.5 bg-culinCard/50 backdrop-blur border border-borderSoft rounded-xl text-culinText placeholder:text-culinMuted/50 focus:outline-none focus:border-culinGreen transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="building" className="block text-sm text-culinMuted mb-2">
                {content.demoForm.fields.building}
              </label>
              <textarea
                id="building"
                name="building"
                rows={3}
                required
                value={form.building}
                onChange={handleChange}
                className="w-full px-5 py-3.5 bg-culinCard/50 backdrop-blur border border-borderSoft rounded-xl text-culinText placeholder:text-culinMuted/50 focus:outline-none focus:border-culinGreen transition-colors resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="submit"
                onClick={() => setIntent('demo')}
                className="flex-1 px-8 py-4 bg-white text-culinBg hover:bg-culinGreen hover:text-white rounded-full font-medium transition-all duration-200"
              >
                {content.demoForm.ctaPrimary}
              </button>
              <button
                type="submit"
                onClick={() => setIntent('waitlist')}
                className="flex-1 px-8 py-4 border-2 border-borderSoft text-culinText hover:border-culinGreen hover:text-culinGreen rounded-full font-medium transition-all duration-200"
              >
                {content.demoForm.ctaSecondary}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
