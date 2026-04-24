import { CognitoUserPool } from 'amazon-cognito-identity-js';

/**
 * AWS Cognito Configuration for CulinAI
 * User Pool ID: us-east-1_a8FLRTD6D
 * Client ID: 36623hj9j2uq5st5ki9esi51eu
 */

const poolData = {
  UserPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || 'us-east-1_a8FLRTD6D',
  ClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || '36623hj9j2uq5st5ki9esi51eu',
};

export const userPool = new CognitoUserPool(poolData);

/**
 * CulinAI Backend API URL (AWS App Runner)
 */
export const API_BASE_URL = 
  process.env.EXPO_PUBLIC_CULINAI_API_URL || 
  'https://qg3p4aatdw.us-east-1.awsapprunner.com';

/**
 * Check if Cognito is properly configured
 */
export const isCognitoConfigured = () => {
  return Boolean(poolData.UserPoolId && poolData.ClientId);
};
