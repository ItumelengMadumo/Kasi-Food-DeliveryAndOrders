// AppSync JS Resolver — Mutation.guestCheckout
// NONE data source. Returns a synthetic User record for guest sessions.
// Real persistence happens later when a guest places an order (the order itself
// stores the guest details).

import { util } from '@aws-appsync/utils';

export function request() {
  return { payload: null };
}

export function response(ctx) {
  const { input } = ctx.args;
  const id = `guest_${util.time.nowEpochMilliSeconds()}`;
  return {
    id,
    name: input.name,
    phone: input.phone,
    email: null,
    role: 'CUSTOMER',
    isGuest: true,
    createdAt: util.time.nowISO8601(),
  };
}
