#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = require("aws-cdk-lib");
const manufacturing_platform_stack_1 = require("../lib/manufacturing-platform-stack");
const app = new cdk.App();
// Get environment and tenant configuration from context
const environment = app.node.tryGetContext('environment') || 'development';
const tenantId = app.node.tryGetContext('tenantId');
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';
// Multi-tenant deployment (shared infrastructure)
if (!tenantId) {
    new manufacturing_platform_stack_1.ManufacturingPlatformStack(app, `ManufacturingPlatform-${environment}`, {
        environment,
        env: {
            account,
            region,
        },
    });
}
else {
    // Single-tenant deployment (dedicated infrastructure)
    new manufacturing_platform_stack_1.ManufacturingPlatformStack(app, `ManufacturingPlatform-${tenantId}-${environment}`, {
        environment,
        tenantId,
        env: {
            account,
            region,
        },
    });
}
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2RrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHVDQUFxQztBQUNyQyxtQ0FBbUM7QUFDbkMsc0ZBQWlGO0FBRWpGLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLHdEQUF3RDtBQUN4RCxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxhQUFhLENBQUM7QUFDM0UsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDcEQsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQztBQUNoRCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVcsQ0FBQztBQUU3RCxrREFBa0Q7QUFDbEQsSUFBSSxDQUFDLFFBQVEsRUFBRTtJQUNiLElBQUkseURBQTBCLENBQUMsR0FBRyxFQUFFLHlCQUF5QixXQUFXLEVBQUUsRUFBRTtRQUMxRSxXQUFXO1FBQ1gsR0FBRyxFQUFFO1lBQ0gsT0FBTztZQUNQLE1BQU07U0FDUDtLQUNGLENBQUMsQ0FBQztDQUNKO0tBQU07SUFDTCxzREFBc0Q7SUFDdEQsSUFBSSx5REFBMEIsQ0FBQyxHQUFHLEVBQUUseUJBQXlCLFFBQVEsSUFBSSxXQUFXLEVBQUUsRUFBRTtRQUN0RixXQUFXO1FBQ1gsUUFBUTtRQUNSLEdBQUcsRUFBRTtZQUNILE9BQU87WUFDUCxNQUFNO1NBQ1A7S0FDRixDQUFDLENBQUM7Q0FDSjtBQUVELEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBNYW51ZmFjdHVyaW5nUGxhdGZvcm1TdGFjayB9IGZyb20gJy4uL2xpYi9tYW51ZmFjdHVyaW5nLXBsYXRmb3JtLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gR2V0IGVudmlyb25tZW50IGFuZCB0ZW5hbnQgY29uZmlndXJhdGlvbiBmcm9tIGNvbnRleHRcbmNvbnN0IGVudmlyb25tZW50ID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52aXJvbm1lbnQnKSB8fCAnZGV2ZWxvcG1lbnQnO1xuY29uc3QgdGVuYW50SWQgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCd0ZW5hbnRJZCcpO1xuY29uc3QgYWNjb3VudCA9IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQ7XG5jb25zdCByZWdpb24gPSBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMSc7XG5cbi8vIE11bHRpLXRlbmFudCBkZXBsb3ltZW50IChzaGFyZWQgaW5mcmFzdHJ1Y3R1cmUpXG5pZiAoIXRlbmFudElkKSB7XG4gIG5ldyBNYW51ZmFjdHVyaW5nUGxhdGZvcm1TdGFjayhhcHAsIGBNYW51ZmFjdHVyaW5nUGxhdGZvcm0tJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgZW52aXJvbm1lbnQsXG4gICAgZW52OiB7XG4gICAgICBhY2NvdW50LFxuICAgICAgcmVnaW9uLFxuICAgIH0sXG4gIH0pO1xufSBlbHNlIHtcbiAgLy8gU2luZ2xlLXRlbmFudCBkZXBsb3ltZW50IChkZWRpY2F0ZWQgaW5mcmFzdHJ1Y3R1cmUpXG4gIG5ldyBNYW51ZmFjdHVyaW5nUGxhdGZvcm1TdGFjayhhcHAsIGBNYW51ZmFjdHVyaW5nUGxhdGZvcm0tJHt0ZW5hbnRJZH0tJHtlbnZpcm9ubWVudH1gLCB7XG4gICAgZW52aXJvbm1lbnQsXG4gICAgdGVuYW50SWQsXG4gICAgZW52OiB7XG4gICAgICBhY2NvdW50LFxuICAgICAgcmVnaW9uLFxuICAgIH0sXG4gIH0pO1xufVxuXG5hcHAuc3ludGgoKTsiXX0=