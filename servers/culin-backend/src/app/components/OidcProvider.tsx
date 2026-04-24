'use client';

/**
 * OIDC Auth Provider
 * 
 * Wraps the application with react-oidc-context AuthProvider
 */

import { AuthProvider as OidcAuthProvider } from 'react-oidc-context';
import { cognitoOidcConfig } from '@/lib/oidc-config';
import { ReactNode } from 'react';

interface OidcProviderProps {
  children: ReactNode;
}

export default function OidcProvider({ children }: OidcProviderProps) {
  return (
    <OidcAuthProvider {...cognitoOidcConfig}>
      {children}
    </OidcAuthProvider>
  );
}
