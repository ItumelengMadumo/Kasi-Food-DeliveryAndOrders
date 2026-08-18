'use strict';

/**
 * getNearbyVendors Lambda Function
 *
 * AppSync's direct JS resolvers run a restricted subset of JS with no
 * trig functions (Math.sin/cos/sqrt/abs all fail with
 * "Invalid function"), so haversine distance filtering has to happen in
 * a real Node runtime instead. Still a full table Scan at this vendor
 * count — a geohash GSI would only be worth it at much larger scale.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';
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

exports.handler = async (event) => {
  const { location, radiusKm } = event.arguments || {};
  if (!location) throw new Error('location is required');

  const radius = radiusKm || DEFAULT_RADIUS_KM;

  const result = await ddb.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :sk AND #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':sk': 'PROFILE', ':status': 'APPROVED' },
    })
  );

  return (result.Items || [])
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
};
