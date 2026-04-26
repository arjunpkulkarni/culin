import AsyncStorage from '@react-native-async-storage/async-storage';
import { CognitoUserPool } from 'amazon-cognito-identity-js';

/**
 * AWS Cognito Configuration for CulinAI
 * User Pool ID: us-east-1_a8FLRTD6D
 * Client ID: 36623hj9j2uq5st5ki9esi51eu
 *
 * `Storage: AsyncStorage` is what makes sessions persist across app
 * restarts on React Native. Without it, amazon-cognito-identity-js falls
 * back to in-memory storage and the user is signed out as soon as iOS
 * kills the backgrounded app. The library's TS types declare Storage as
 * synchronous, but at runtime it correctly handles AsyncStorage's
 * Promise-returning API — hence the `as any` cast.
 */

const poolData = {
  UserPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || 'us-east-1_a8FLRTD6D',
  ClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || '36623hj9j2uq5st5ki9esi51eu',
  Storage: AsyncStorage as any,
};

export const userPool = new CognitoUserPool(poolData);

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
