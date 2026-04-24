'use client';

/**
 * Auth Layout
 * 
 * Simple layout for authentication pages (no special wrapper needed since OidcProvider is in root)
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
