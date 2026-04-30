// AppSync JS Resolver — Mutation.registerUser
// NONE data source. Real registration happens via Cognito (frontend uses Amplify).
// Kept so the schema stays valid; calling it returns an error.

import { util } from '@aws-appsync/utils';

export function request() {
  return { payload: null };
}

export function response() {
  util.error(
    'registerUser is not supported via AppSync. Use Cognito sign-up via Amplify.',
    'OperationUnsupported'
  );
}
