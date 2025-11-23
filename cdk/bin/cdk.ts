#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ManufacturingPlatformStack } from '../lib/manufacturing-platform-stack';

const app = new cdk.App();

// Get environment and tenant configuration from context
const environment = app.node.tryGetContext('environment') || 'development';
const tenantId = app.node.tryGetContext('tenantId');
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Multi-tenant deployment (shared infrastructure)
if (!tenantId) {
  new ManufacturingPlatformStack(app, `ManufacturingPlatform-${environment}`, {
    environment,
    env: {
      account,
      region,
    },
  });
} else {
  // Single-tenant deployment (dedicated infrastructure)
  new ManufacturingPlatformStack(app, `ManufacturingPlatform-${tenantId}-${environment}`, {
    environment,
    tenantId,
    env: {
      account,
      region,
    },
  });
}

app.synth();