// AppSync JS Resolver — Mutation.approveVendor
// This resolver is a Lambda data source stub.
// The actual business logic lives in infra/lambda/approveVendor/index.js.
//
// Wire this mutation to the approveVendor Lambda as a Lambda data source
// in your CDK / Amplify deployment configuration:
//
//   dataSource: approveVendorLambdaDS (LambdaDataSource pointing to approveVendor)
//   requestMappingTemplate: forward ctx.arguments to the Lambda event
//   responseMappingTemplate: return the Lambda result as-is
//
// The resolver below is provided for documentation purposes. When using
// AppSync JS resolvers with a Lambda data source, the framework handles
// the invocation automatically — no custom request/response needed.

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Invoke',
    payload: {
      arguments: ctx.args,
      identity: ctx.identity,
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  return ctx.result;
}
