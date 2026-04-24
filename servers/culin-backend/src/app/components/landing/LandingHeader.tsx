'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';

export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-culinBg/95 backdrop-blur-xl border-b border-borderSoft"
          : "bg-transparent"
      )}
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-[70px]">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/icon2.png"
              alt="Culin"
              width={80}
              height={80}
              className="w-20 h-20"
            />
          </Link>

          {/* CTA */}
          <div className="flex items-center gap-4">
            
            <button
              onClick={() => router.push('/chat')}
              className="bg-white text-culinBg hover:bg-culinGreen hover:text-white px-6 py-2 rounded-full transition-all duration-200 text-sm font-medium"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
