/// <reference types="vite/client" />

/**
 * AWS Amplify configuration
 * Configure Cognito User Pool auth for the Vite frontend.
 */

import { Amplify } from 'aws-amplify';

function isPlaceholder(value: string | undefined) {
  if (!value) return true;
  return /x{5,}|your-|placeholder/i.test(value);
}

/**
 * Configure Amplify if real env vars are present.
 * Returns true when configured, false when skipped.
 */
export function configureAmplify(): boolean {
  const region = import.meta.env.VITE_AWS_REGION || 'us-east-1';
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const endpoint = import.meta.env.VITE_APPSYNC_ENDPOINT;
  const apiKey = import.meta.env.VITE_APPSYNC_API_KEY;

  if (isPlaceholder(userPoolId) || isPlaceholder(userPoolClientId)) {
    console.info(
      '[Amplify] Missing Cognito env vars. Authentication and cloud API calls are disabled until these are configured.\n' +
      'Copy frontend/.env.example to frontend/.env and set real AWS values.'
    );
    return false;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: userPoolId!,
        userPoolClientId: userPoolClientId!,
        signUpVerificationMethod: 'code' as const,
        loginWith: { email: true, phone: true, username: true },
      },
    },
    API: {
      GraphQL: {
        endpoint: endpoint || '',
        region,
        apiKey: apiKey || undefined,
        // Most traffic is unauthenticated guest browsing/ordering, so API key
        // is the default. Vendor/admin-only operations explicitly override
        // to authMode: 'userPool' per call in services/api.ts.
        defaultAuthMode: 'apiKey' as const,
      },
    },
  });
  return true;
}
