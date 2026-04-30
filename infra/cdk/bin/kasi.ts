#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { KasiStack } from '../lib/kasi-stack';

const app = new cdk.App();

const stage = (app.node.tryGetContext('stage') as string) || 'dev';
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;

new KasiStack(app, `KasiStack-${stage}`, {
  env: { account, region },
  stage,
  description: `Kasi Food Delivery — ${stage} (data, auth, api, lambdas)`,
});
