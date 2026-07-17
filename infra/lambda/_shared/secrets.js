'use strict';

/**
 * Cached Secrets Manager reader. Each secret is JSON-shaped — see
 * infra/cdk/lib/kasi-stack.ts for the fields of each one.
 */

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({});

const cache = new Map(); // envVarName -> { value, cachedAt }
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getSecret(envVarName) {
  const now = Date.now();
  const entry = cache.get(envVarName);
  if (entry && now - entry.cachedAt < CACHE_TTL_MS) return entry.value;

  const secretId = process.env[envVarName];
  if (!secretId) throw new Error(`${envVarName} is not configured`);

  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const value = JSON.parse(result.SecretString || '{}');
  cache.set(envVarName, { value, cachedAt: now });
  return value;
}

const getPaymentSecrets = () => getSecret('PAYMENTS_SECRET_ARN');
const getWhatsAppSecrets = () => getSecret('WHATSAPP_SECRET_ARN');

module.exports = { getSecret, getPaymentSecrets, getWhatsAppSecrets };
