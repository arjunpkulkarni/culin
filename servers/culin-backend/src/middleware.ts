/**
 * Middleware Configuration
 * 
 * Optional: Add middleware logic here if needed
 * For now, we're using client-side route protection with OidcProtectedRoute
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Currently no middleware logic needed
  // Authentication is handled client-side by react-oidc-context
  // and API routes use withAuth middleware
  return NextResponse.next();
}

// Optional: Configure which routes this middleware runs on
// export const config = {
//   matcher: [
//     /*
//      * Match all request paths except for the ones starting with:
//      * - api (API routes)
//      * - _next/static (static files)
//      * - _next/image (image optimization files)
//      * - favicon.ico (favicon file)
//      */
//     '/((?!api|_next/static|_next/image|favicon.ico).*)',
//   ],
// };