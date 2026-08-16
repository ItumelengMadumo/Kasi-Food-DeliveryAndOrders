// AppSync JS Resolver — Query.getNearbyVendors
// Soft-launch scale: still a full table Scan (a geohash GSI or PostGIS via
// Aurora would only be worth it at a much larger catalog size), but now
// actually honors `location`/`radiusKm` — previously both were ignored and
// every APPROVED vendor was returned regardless of distance.

import { util } from '@aws-appsync/utils';

const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_KM = 15;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function distanceKm(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_KM * c;
}

export function request(ctx) {
  return {
    operation: 'Scan',
    filter: {
      expression: 'SK = :sk AND #status = :status',
      expressionNames: { '#status': 'status' },
      expressionValues: {
        ':sk': util.dynamodb.toDynamoDB('PROFILE'),
        ':status': util.dynamodb.toDynamoDB('APPROVED'),
      },
    },
  };
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type);

  const { location, radiusKm } = ctx.args;
  const radius = radiusKm || DEFAULT_RADIUS_KM;

  return (ctx.result.items || [])
    .filter((item) => typeof item.PK === 'string' && item.PK.indexOf('VENDOR#') === 0)
    .filter((item) => item.location && distanceKm(location, item.location) <= radius)
    .sort((a, b) => distanceKm(location, a.location) - distanceKm(location, b.location))
    .map((item) => ({
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
      digitalPaymentsEnabled: item.digitalPaymentsEnabled === true,
      whatsappNumber: item.whatsappNumber,
      refPrefix: item.refPrefix,
      imageUrl: item.imageUrl,
      description: item.description,
      rating: item.rating,
      totalReviews: item.totalReviews,
      createdAt: item.createdAt,
    }));
}
