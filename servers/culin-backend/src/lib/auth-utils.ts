/**
 * Authentication Utility Functions
 * 
 * This module provides helper functions for authentication operations
 * including token verification, user session management, and API route protection.
 */

import { NextRequest } from 'next/server';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { cognitoConfig } from './cognito-config';

// Create JWT verifier for access tokens
const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: cognitoConfig.userPoolId,
  tokenUse: 'access',
  clientId: cognitoConfig.userPoolClientId,
});

// Create JWT verifier for ID tokens (contains user attributes)
const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: cognitoConfig.userPoolId,
  tokenUse: 'id',
  clientId: cognitoConfig.userPoolClientId,
});

export interface AuthUser {
  sub: string; // User ID
  email?: string;
  email_verified?: boolean;
  username?: string;
  [key: string]: any;
}

/**
 * Extract and verify JWT token from request headers
 * @param request - NextRequest object
 * @returns Verified token payload or null if invalid
 */
export async function verifyAccessToken(request: NextRequest): Promise<any | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const payload = await accessTokenVerifier.verify(token);
    return payload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Extract and verify ID token from request headers
 * @param request - NextRequest object
 * @returns Verified ID token payload with user info or null if invalid
 */
export async function verifyIdToken(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const payload = await idTokenVerifier.verify(token);
    return payload as AuthUser;
  } catch (error) {
    console.error('ID token verification failed:', error);
    return null;
  }
}

/**
 * Middleware function to protect API routes
 * Use this in your API route handlers to ensure authentication
 * 
 * @example
 * export async function POST(req: NextRequest) {
 *   const user = await requireAuth(req);
 *   if (!user) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // ... rest of your API logic
 * }
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser | null> {
  return await verifyIdToken(request);
}

/**
 * Extract user information from both cookie-based and header-based auth
 * This supports both client-side (cookie) and API-based (header) authentication
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  // First try header-based auth (for API calls)
  const user = await verifyIdToken(request);
  if (user) {
    return user;
  }

  // Could add cookie-based auth here if needed
  return null;
}

/**
 * Check if a user has a specific permission or role
 * (Extend this based on your Cognito groups/custom attributes)
 */
export function hasPermission(user: AuthUser, permission: string): boolean {
  // Implement your permission logic here
  // Example: Check Cognito groups
  const groups = user['cognito:groups'] || [];
  return groups.includes(permission);
}

/**
 * Check if user is an admin
 */
export function isAdmin(user: AuthUser): boolean {
  return hasPermission(user, 'admin');
}
