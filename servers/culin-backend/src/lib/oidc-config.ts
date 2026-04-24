/**
 * OIDC Cognito Configuration
 * 
 * Configuration for react-oidc-context with AWS Cognito
 */

export const cognitoOidcConfig = {
  // Cognito domain: https://cognito-idp.{region}.amazonaws.com/{userPoolId}
  authority: process.env.NEXT_PUBLIC_COGNITO_AUTHORITY || 
    `https://cognito-idp.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'us-east-1_a8FLRTD6D'}`,
  
  // Your Cognito App Client ID
  client_id: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '36623hj9j2uq5st5ki9esi51eu',
  
  // Redirect URI after successful login
  redirect_uri: process.env.NEXT_PUBLIC_REDIRECT_URI || 'http://localhost:3000',
  
  // Response type
  response_type: 'code',
  
  // Requested scopes
  scope: process.env.NEXT_PUBLIC_COGNITO_SCOPES || 'phone openid email',
  
  // Optional: Logout redirect URI
  post_logout_redirect_uri: process.env.NEXT_PUBLIC_LOGOUT_URI || 'http://localhost:3000',
  
  // Optional: Cognito hosted UI domain (for logout)
  cognito_domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
};

// Helper to get the logout URL
export function getCognitoLogoutUrl() {
  const clientId = cognitoOidcConfig.client_id;
  const logoutUri = cognitoOidcConfig.post_logout_redirect_uri;
  const cognitoDomain = cognitoOidcConfig.cognito_domain;
  
  if (!cognitoDomain) {
    console.warn('COGNITO_DOMAIN not set, using removeUser() instead of hosted UI logout');
    return null;
  }
  
  return `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
}
