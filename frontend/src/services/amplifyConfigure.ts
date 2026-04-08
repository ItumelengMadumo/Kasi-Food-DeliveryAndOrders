/// <reference types="vite/client" />

/**
 * AWS Amplify configuration
 * Replace placeholder values with your actual AppSync and Cognito settings.
 */

import { Amplify } from 'aws-amplify';

const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
      userPoolClientId:
        import.meta.env.VITE_COGNITO_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
      signUpVerificationMethod: 'code' as const,
    },
  },
  API: {
    GraphQL: {
      endpoint:
        import.meta.env.VITE_APPSYNC_ENDPOINT ||
        'https://xxxxxxxxxx.appsync-api.us-east-1.amazonaws.com/graphql',
      region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
      defaultAuthMode: 'userPool' as const,
    },
  },
};

export function configureAmplify() {
  Amplify.configure(awsConfig);
}
