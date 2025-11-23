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
        tags: {
            Environment: environment,
            Project: 'ManufacturingPlatform',
            Deployment: 'MultiTenant',
            CostCenter: 'Manufacturing',
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
        tags: {
            Environment: environment,
            Project: 'ManufacturingPlatform',
            Deployment: 'SingleTenant',
            TenantId: tenantId,
            CostCenter: 'Manufacturing',
        },
    });
}
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFudWZhY3R1cmluZy1wbGF0Zm9ybS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1hbnVmYWN0dXJpbmctcGxhdGZvcm0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsdUNBQXFDO0FBQ3JDLG1DQUFtQztBQUNuQyxzRkFBaUY7QUFFakYsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsd0RBQXdEO0FBQ3hELE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLGFBQWEsQ0FBQztBQUMzRSxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNwRCxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDO0FBQ2hELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVyxDQUFDO0FBRTdELGtEQUFrRDtBQUNsRCxJQUFJLENBQUMsUUFBUSxFQUFFO0lBQ2IsSUFBSSx5REFBMEIsQ0FBQyxHQUFHLEVBQUUseUJBQXlCLFdBQVcsRUFBRSxFQUFFO1FBQzFFLFdBQVc7UUFDWCxHQUFHLEVBQUU7WUFDSCxPQUFPO1lBQ1AsTUFBTTtTQUNQO1FBQ0QsSUFBSSxFQUFFO1lBQ0osV0FBVyxFQUFFLFdBQVc7WUFDeEIsT0FBTyxFQUFFLHVCQUF1QjtZQUNoQyxVQUFVLEVBQUUsYUFBYTtZQUN6QixVQUFVLEVBQUUsZUFBZTtTQUM1QjtLQUNGLENBQUMsQ0FBQztDQUNKO0tBQU07SUFDTCxzREFBc0Q7SUFDdEQsSUFBSSx5REFBMEIsQ0FBQyxHQUFHLEVBQUUseUJBQXlCLFFBQVEsSUFBSSxXQUFXLEVBQUUsRUFBRTtRQUN0RixXQUFXO1FBQ1gsUUFBUTtRQUNSLEdBQUcsRUFBRTtZQUNILE9BQU87WUFDUCxNQUFNO1NBQ1A7UUFDRCxJQUFJLEVBQUU7WUFDSixXQUFXLEVBQUUsV0FBVztZQUN4QixPQUFPLEVBQUUsdUJBQXVCO1lBQ2hDLFVBQVUsRUFBRSxjQUFjO1lBQzFCLFFBQVEsRUFBRSxRQUFRO1lBQ2xCLFVBQVUsRUFBRSxlQUFlO1NBQzVCO0tBQ0YsQ0FBQyxDQUFDO0NBQ0o7QUFFRCxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgTWFudWZhY3R1cmluZ1BsYXRmb3JtU3RhY2sgfSBmcm9tICcuLi9saWIvbWFudWZhY3R1cmluZy1wbGF0Zm9ybS1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIEdldCBlbnZpcm9ubWVudCBhbmQgdGVuYW50IGNvbmZpZ3VyYXRpb24gZnJvbSBjb250ZXh0XG5jb25zdCBlbnZpcm9ubWVudCA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2Vudmlyb25tZW50JykgfHwgJ2RldmVsb3BtZW50JztcbmNvbnN0IHRlbmFudElkID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgndGVuYW50SWQnKTtcbmNvbnN0IGFjY291bnQgPSBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5UO1xuY29uc3QgcmVnaW9uID0gcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICd1cy1lYXN0LTEnO1xuXG4vLyBNdWx0aS10ZW5hbnQgZGVwbG95bWVudCAoc2hhcmVkIGluZnJhc3RydWN0dXJlKVxuaWYgKCF0ZW5hbnRJZCkge1xuICBuZXcgTWFudWZhY3R1cmluZ1BsYXRmb3JtU3RhY2soYXBwLCBgTWFudWZhY3R1cmluZ1BsYXRmb3JtLSR7ZW52aXJvbm1lbnR9YCwge1xuICAgIGVudmlyb25tZW50LFxuICAgIGVudjoge1xuICAgICAgYWNjb3VudCxcbiAgICAgIHJlZ2lvbixcbiAgICB9LFxuICAgIHRhZ3M6IHtcbiAgICAgIEVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICAgIFByb2plY3Q6ICdNYW51ZmFjdHVyaW5nUGxhdGZvcm0nLFxuICAgICAgRGVwbG95bWVudDogJ011bHRpVGVuYW50JyxcbiAgICAgIENvc3RDZW50ZXI6ICdNYW51ZmFjdHVyaW5nJyxcbiAgICB9LFxuICB9KTtcbn0gZWxzZSB7XG4gIC8vIFNpbmdsZS10ZW5hbnQgZGVwbG95bWVudCAoZGVkaWNhdGVkIGluZnJhc3RydWN0dXJlKVxuICBuZXcgTWFudWZhY3R1cmluZ1BsYXRmb3JtU3RhY2soYXBwLCBgTWFudWZhY3R1cmluZ1BsYXRmb3JtLSR7dGVuYW50SWR9LSR7ZW52aXJvbm1lbnR9YCwge1xuICAgIGVudmlyb25tZW50LFxuICAgIHRlbmFudElkLFxuICAgIGVudjoge1xuICAgICAgYWNjb3VudCxcbiAgICAgIHJlZ2lvbixcbiAgICB9LFxuICAgIHRhZ3M6IHtcbiAgICAgIEVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICAgIFByb2plY3Q6ICdNYW51ZmFjdHVyaW5nUGxhdGZvcm0nLFxuICAgICAgRGVwbG95bWVudDogJ1NpbmdsZVRlbmFudCcsXG4gICAgICBUZW5hbnRJZDogdGVuYW50SWQsXG4gICAgICBDb3N0Q2VudGVyOiAnTWFudWZhY3R1cmluZycsXG4gICAgfSxcbiAgfSk7XG59XG5cbmFwcC5zeW50aCgpOyJdfQ==