#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { KasiStack } from '../lib/kasi-stack';

const app = new cdk.App();

const stage = (app.node.tryGetContext('stage') as string) || 'dev';
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;

// Amplify Hosting domain for the connected frontend app. Override with
// `--context frontendUrl=https://your-domain` if the branch/app changes.
const frontendUrl =
  (app.node.tryGetContext('frontendUrl') as string) ||
  'https://main.d1gv22a1k7f1j2.amplifyapp.com';

new KasiStack(app, `KasiStack-${stage}`, {
  env: { account, region },
  stage,
  frontendUrl,
  description: `Kasi Food Delivery — ${stage} (data, auth, api, lambdas, payments)`,
});
