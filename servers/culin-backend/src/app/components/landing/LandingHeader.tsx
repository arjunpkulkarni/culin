'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { content } from '@/lib/content';

export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToDemo = () => {
    setMenuOpen(false);
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-culinBg/95 backdrop-blur-xl border-b border-borderSoft'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-[70px]">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-medium text-culinText tracking-tight">
              Culin<span className="text-culinGreen">AI</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {content.nav.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-culinMuted hover:text-culinGreen transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={scrollToDemo}
              className="hidden sm:inline-flex bg-white text-culinBg hover:bg-culinGreen hover:text-white px-6 py-2 rounded-full transition-all duration-200 text-sm font-medium"
            >
              Request Demo
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 text-culinMuted hover:text-culinGreen transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="lg:hidden pb-6 border-t border-borderSoft pt-4">
            <div className="flex flex-col gap-4">
              {content.nav.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-culinMuted hover:text-culinGreen transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={scrollToDemo}
                className="mt-2 bg-white text-culinBg hover:bg-culinGreen hover:text-white px-6 py-3 rounded-full transition-all duration-200 text-sm font-medium w-fit"
              >
                Request Demo
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
