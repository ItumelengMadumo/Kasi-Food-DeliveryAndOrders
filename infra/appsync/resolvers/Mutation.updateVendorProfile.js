// AppSync JS Resolver — Mutation.updateVendorProfile

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { input } = ctx.args;
  const { vendorId } = input;

  const setExpr = [];
  const names = {};
  const values = {};

  const fields = [
    'name',
    'address',
    'contactDetails',
    'workingHours',
    'deliveryType',
    'deliveryValue',
    'hasBankAccount',
    'whatsappNumber',
    'description',
    'imageUrl',
  ];

  for (const f of fields) {
    if (input[f] !== undefined && input[f] !== null) {
      setExpr.push(`#${f} = :${f}`);
      names[`#${f}`] = f;
      values[`:${f}`] = input[f];
    }
  }

  setExpr.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = util.time.nowISO8601();

  // If whatsappNumber is provided, also update GSI3PK so the lookup index stays in sync.
  if (input.whatsappNumber) {
    setExpr.push('GSI3PK = :gsi3pk');
    values[':gsi3pk'] = input.whatsappNumber;
  }

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      PK: `VENDOR#${vendorId}`,
      SK: 'PROFILE',
    }),
    update: {
      expression: `SET ${setExpr.join(', ')}`,
      expressionNames: names,
      expressionValues: util.dynamodb.toMapValues(values),
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);
  const item = ctx.result;
  return {
    id: item.vendorId || item.PK.replace('VENDOR#', ''),
    ownerId: item.ownerId,
    name: item.name,
    address: item.address,
    location: item.location,
    contactDetails: item.contactDetails,
    workingHours: item.workingHours,
    status: item.status,
    deliveryType: item.deliveryType,
    deliveryValue: item.deliveryValue,
    hasBankAccount: item.hasBankAccount === true,
    whatsappNumber: item.whatsappNumber,
    refPrefix: item.refPrefix,
    imageUrl: item.imageUrl,
    description: item.description,
    rating: item.rating,
    totalReviews: item.totalReviews,
    createdAt: item.createdAt,
  };
}
