'use strict';

/**
 * calculateDelivery Lambda Function
 *
 * Called by AppSync query or as a utility.
 * Calculates the delivery fee for a given vendor and order subtotal.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'KasiMainTable';

exports.handler = async (event) => {
  console.log('calculateDelivery event:', JSON.stringify(event, null, 2));

  const { vendorId, subtotal, deliveryMethod } = event.arguments || event;

  if (!vendorId) throw new Error('vendorId is required');
  if (subtotal == null) throw new Error('subtotal is required');

  if (deliveryMethod === 'PICKUP') {
    return { deliveryFee: 0, breakdown: 'No fee for pickup orders' };
  }

  const vendorResult = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `VENDOR#${vendorId}`, SK: 'PROFILE' },
    })
  );

  if (!vendorResult.Item) {
    throw new Error(`Vendor ${vendorId} not found`);
  }

  const { deliveryType, deliveryValue } = vendorResult.Item;

  if (!deliveryType || deliveryValue == null) {
    return { deliveryFee: 0, breakdown: 'Vendor has not configured delivery fee' };
  }

  let deliveryFee = 0;
  let breakdown = '';

  if (deliveryType === 'PERCENTAGE') {
    deliveryFee = parseFloat(((deliveryValue / 100) * subtotal).toFixed(2));
    breakdown = `${deliveryValue}% of R${subtotal} = R${deliveryFee}`;
  } else if (deliveryType === 'FLAT') {
    deliveryFee = parseFloat(deliveryValue.toFixed(2));
    breakdown = `Flat rate: R${deliveryFee}`;
  }

  return { deliveryFee, breakdown };
};
