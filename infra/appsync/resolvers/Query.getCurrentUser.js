// AppSync JS Resolver — Query.getCurrentUser
// NONE data source: returns the user identity from the auth context.
// Returns null when called via API_KEY (no Cognito identity).

import { util } from '@aws-appsync/utils';

export function request() {
  return { payload: null };
}

export function response(ctx) {
  const identity = ctx.identity;
  if (!identity || !identity.sub) return null;
  const claims = identity.claims || {};
  const groups = claims['cognito:groups'] || [];
  const role =
    claims['custom:role'] ||
    (Array.isArray(groups) && groups.length ? groups[0] : 'CUSTOMER');
  return {
    id: identity.sub,
    name: claims.name || claims.email || claims.phone_number || identity.username,
    phone: claims.phone_number || '',
    email: claims.email,
    role: role,
    isGuest: false,
    createdAt: util.time.nowISO8601(),
  };
}
