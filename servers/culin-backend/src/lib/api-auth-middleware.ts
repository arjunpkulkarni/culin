/**
 * API Route Authentication Middleware
 * 
 * This middleware function protects API routes by verifying JWT tokens
 * and can be easily applied to any API route handler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthUser } from '@/lib/auth-utils';

// Re-export AuthUser for convenience
export type { AuthUser };

export interface AuthenticatedRequest extends NextRequest {
  user?: AuthUser;
}

/**
 * Higher-order function to wrap API route handlers with authentication
 * 
 * @example
 * export const POST = withAuth(async (req, user) => {
 *   // user is guaranteed to exist here
 *   return NextResponse.json({ message: 'Authenticated!', userId: user.sub });
 * });
 */
export function withAuth(
  handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      const user = await requireAuth(request);
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in to access this resource.' },
          { status: 401 }
        );
      }

      // Call the original handler with the authenticated user
      return handler(request, user);
    } catch (error) {
      console.error('Authentication error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}

/**
 * Optional authentication - allows both authenticated and unauthenticated requests
 * But provides user info if available
 */
export function withOptionalAuth(
  handler: (request: NextRequest, user: AuthUser | null) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      const user = await requireAuth(request);
      return handler(request, user);
    } catch (error) {
      console.error('Authentication check error:', error);
      return handler(request, null);
    }
  };
}

/**
 * Standalone middleware check (for use in middleware.ts)
 */
export async function authMiddleware(request: NextRequest) {
  const user = await requireAuth(request);
  
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return null; // Continue to the route
}
