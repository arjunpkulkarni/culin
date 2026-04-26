import { CognitoUserPool } from 'amazon-cognito-identity-js';

/**
 * AWS Cognito Configuration for CulinAI
 * User Pool ID: us-east-1_a8FLRTD6D
 * Client ID: 36623hj9j2uq5st5ki9esi51eu
 *
 * Session persistence on React Native:
 * amazon-cognito-identity-js auto-resolves `StorageHelper-rn.js` for RN
 * targets. That helper writes tokens to both an in-memory cache AND
 * AsyncStorage, but reads only from the in-memory cache (which is empty
 * on a fresh process). Call `syncCognitoStorage()` once at app start to
 * hydrate the cache from AsyncStorage so getCurrentUser() can find an
 * existing session after a restart.
 */

const poolData = {
  UserPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || 'us-east-1_a8FLRTD6D',
  ClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || '36623hj9j2uq5st5ki9esi51eu',
};

export const userPool = new CognitoUserPool(poolData);

/**
 * Hydrate the Cognito storage cache from AsyncStorage. Must be awaited
 * before userPool.getCurrentUser() can return a previously signed-in user
 * after the app has been killed and relaunched.
 *
 * Safe to call multiple times. Resolves immediately if running on a
 * platform where the storage doesn't expose a sync() method (e.g. web).
 */
export async function syncCognitoStorage(): Promise<void> {
  return new Promise((resolve) => {
    const storage = (userPool as unknown as { storage: { sync?: (cb: (err: Error | null) => void) => void } }).storage;
    if (!storage || typeof storage.sync !== 'function') {
      resolve();
      return;
    }
    storage.sync((err) => {
      if (err) {
        console.warn('Cognito storage hydrate failed:', err);
      }
      resolve();
    });
  });
}

/**
 * CulinAI Backend API URL (AWS App Runner)
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_CULINAI_API_URL ||
  'https://api.recipe-gen.culin.ai';

/**
 * Check if Cognito is properly configured
 */
export const isCognitoConfigured = () => {
  return Boolean(poolData.UserPoolId && poolData.ClientId);
};
