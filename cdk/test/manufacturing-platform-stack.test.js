"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assertions_1 = require("aws-cdk-lib/assertions");
const cdk = require("aws-cdk-lib");
const manufacturing_platform_stack_1 = require("../lib/manufacturing-platform-stack");
describe('ManufacturingPlatformStack', () => {
    let app;
    let stack;
    let template;
    beforeEach(() => {
        app = new cdk.App();
        stack = new manufacturing_platform_stack_1.ManufacturingPlatformStack(app, 'TestStack', {
            environment: 'test',
        });
        template = assertions_1.Template.fromStack(stack);
    });
    test('Creates VPC with correct configuration', () => {
        template.hasResourceProperties('AWS::EC2::VPC', {
            CidrBlock: '10.0.0.0/16',
            EnableDnsHostnames: true,
            EnableDnsSupport: true,
        });
        // Check for public, private, and isolated subnets
        template.resourceCountIs('AWS::EC2::Subnet', 9); // 3 AZs x 3 subnet types
    });
    test('Creates TimescaleDB instance', () => {
        template.hasResourceProperties('AWS::RDS::DBInstance', {
            DBInstanceClass: 'db.r6g.large',
            Engine: 'postgres',
            Port: 5433,
            StorageEncrypted: true,
        });
    });
    test('Creates PostgreSQL instance', () => {
        template.hasResourceProperties('AWS::RDS::DBInstance', {
            DBInstanceClass: 'db.r6g.xlarge',
            Engine: 'postgres',
            Port: 5432,
            StorageEncrypted: true,
        });
    });
    test('Creates S3 bucket with lifecycle policies', () => {
        template.hasResourceProperties('AWS::S3::Bucket', {
            BucketEncryption: {
                ServerSideEncryptionConfiguration: [
                    {
                        ServerSideEncryptionByDefault: {
                            SSEAlgorithm: 'aws:kms',
                        },
                    },
                ],
            },
            LifecycleConfiguration: {
                Rules: [
                    {
                        Id: 'ArchivalLifecycle',
                        Status: 'Enabled',
                        Transitions: [
                            {
                                StorageClass: 'STANDARD_IA',
                                TransitionInDays: 30,
                            },
                            {
                                StorageClass: 'GLACIER',
                                TransitionInDays: 90,
                            },
                            {
                                StorageClass: 'DEEP_ARCHIVE',
                                TransitionInDays: 365,
                            },
                        ],
                    },
                ],
            },
        });
    });
    test('Creates MSK cluster', () => {
        template.hasResourceProperties('AWS::MSK::Cluster', {
            ClusterName: 'manufacturing-kafka-test',
            KafkaVersion: '2.8.1',
            NumberOfBrokerNodes: 3,
        });
    });
    test('Creates Lambda functions', () => {
        // Should create 4 Lambda functions
        template.resourceCountIs('AWS::Lambda::Function', 4);
        // Check alert processor has optimized configuration
        template.hasResourceProperties('AWS::Lambda::Function', {
            Runtime: 'nodejs18.x',
            Timeout: 15,
            MemorySize: 1024,
            ReservedConcurrencyLimit: 100,
        });
    });
    test('Creates API Gateway with CORS', () => {
        template.hasResourceProperties('AWS::ApiGateway::RestApi', {
            Name: 'Manufacturing Platform API - test',
        });
        // Check for CORS configuration
        template.hasResourceProperties('AWS::ApiGateway::Method', {
            HttpMethod: 'OPTIONS',
        });
    });
    test('Creates SNS topic for alerts', () => {
        template.hasResourceProperties('AWS::SNS::Topic', {
            TopicName: 'manufacturing-alerts-test',
        });
    });
    test('Creates CloudWatch alarms', () => {
        template.hasResourceProperties('AWS::CloudWatch::Alarm', {
            Threshold: 500,
            ComparisonOperator: 'GreaterThanThreshold',
        });
        template.hasResourceProperties('AWS::CloudWatch::Alarm', {
            Threshold: 5,
            ComparisonOperator: 'GreaterThanThreshold',
        });
    });
    test('Creates security groups with proper rules', () => {
        // Database security group allows Lambda access
        template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
            IpProtocol: 'tcp',
            FromPort: 5432,
            ToPort: 5432,
        });
        template.hasResourceProperties('AWS::EC2::SecurityGroupIngress', {
            IpProtocol: 'tcp',
            FromPort: 5433,
            ToPort: 5433,
        });
    });
    test('Creates KMS key for encryption', () => {
        template.hasResourceProperties('AWS::KMS::Key', {
            Description: 'KMS Key for Manufacturing Platform encryption',
            EnableKeyRotation: true,
        });
    });
    test('Creates SSM parameters', () => {
        template.hasResourceProperties('AWS::SSM::Parameter', {
            Name: '/test/manufacturing/timescale-endpoint',
            Type: 'String',
        });
        template.hasResourceProperties('AWS::SSM::Parameter', {
            Name: '/test/manufacturing/postgres-endpoint',
            Type: 'String',
        });
        template.hasResourceProperties('AWS::SSM::Parameter', {
            Name: '/test/manufacturing/kafka-bootstrap-servers',
            Type: 'String',
        });
    });
    describe('Single-tenant configuration', () => {
        beforeEach(() => {
            stack = new manufacturing_platform_stack_1.ManufacturingPlatformStack(app, 'SingleTenantStack', {
                environment: 'test',
                tenantId: 'tenant-123',
            });
            template = assertions_1.Template.fromStack(stack);
        });
        test('Creates tenant-specific resources', () => {
            template.hasResourceProperties('AWS::MSK::Cluster', {
                ClusterName: 'manufacturing-kafka-tenant-123-test',
            });
            template.hasResourceProperties('AWS::SNS::Topic', {
                TopicName: 'manufacturing-alerts-tenant-123-test',
            });
        });
        test('Uses smaller PostgreSQL instance for single tenant', () => {
            template.hasResourceProperties('AWS::RDS::DBInstance', {
                DBInstanceClass: 'db.r6g.large', // Smaller instance for single tenant
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFudWZhY3R1cmluZy1wbGF0Zm9ybS1zdGFjay50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWFudWZhY3R1cmluZy1wbGF0Zm9ybS1zdGFjay50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsdURBQWtEO0FBQ2xELG1DQUFtQztBQUNuQyxzRkFBaUY7QUFFakYsUUFBUSxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtJQUMxQyxJQUFJLEdBQVksQ0FBQztJQUNqQixJQUFJLEtBQWlDLENBQUM7SUFDdEMsSUFBSSxRQUFrQixDQUFDO0lBRXZCLFVBQVUsQ0FBQyxHQUFHLEVBQUU7UUFDZCxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDcEIsS0FBSyxHQUFHLElBQUkseURBQTBCLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRTtZQUN2RCxXQUFXLEVBQUUsTUFBTTtTQUNwQixDQUFDLENBQUM7UUFDSCxRQUFRLEdBQUcscUJBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdkMsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsd0NBQXdDLEVBQUUsR0FBRyxFQUFFO1FBQ2xELFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxlQUFlLEVBQUU7WUFDOUMsU0FBUyxFQUFFLGFBQWE7WUFDeEIsa0JBQWtCLEVBQUUsSUFBSTtZQUN4QixnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILGtEQUFrRDtRQUNsRCxRQUFRLENBQUMsZUFBZSxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMseUJBQXlCO0lBQzVFLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDhCQUE4QixFQUFFLEdBQUcsRUFBRTtRQUN4QyxRQUFRLENBQUMscUJBQXFCLENBQUMsc0JBQXNCLEVBQUU7WUFDckQsZUFBZSxFQUFFLGNBQWM7WUFDL0IsTUFBTSxFQUFFLFVBQVU7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QkFBNkIsRUFBRSxHQUFHLEVBQUU7UUFDM0MsVUFBVSxDQUFDLEdBQUcsRUFBRTtZQUNkLEtBQUssR0FBRyxJQUFJLHlEQUEwQixDQUFDLEdBQUcsRUFBRSxtQkFBbUIsRUFBRTtnQkFDL0QsV0FBVyxFQUFFLE1BQU07Z0JBQ25CLFFBQVEsRUFBRSxZQUFZO2FBQ3ZCLENBQUMsQ0FBQztZQUNILFFBQVEsR0FBRyxxQkFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxtQ0FBbUMsRUFBRSxHQUFHLEVBQUU7WUFDN0MsUUFBUSxDQUFDLHFCQUFxQixDQUFDLG1CQUFtQixFQUFFO2dCQUNsRCxXQUFXLEVBQUUscUNBQXFDO2FBQ25ELENBQUMsQ0FBQztZQUVILFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxpQkFBaUIsRUFBRTtnQkFDaEQsU0FBUyxFQUFFLHNDQUFzQzthQUNsRCxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxvREFBb0QsRUFBRSxHQUFHLEVBQUU7WUFDOUQsUUFBUSxDQUFDLHFCQUFxQixDQUFDLHNCQUFzQixFQUFFO2dCQUNyRCxlQUFlLEVBQUUsY0FBYyxFQUFFLHFDQUFxQzthQUN2RSxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUZW1wbGF0ZSB9IGZyb20gJ2F3cy1jZGstbGliL2Fzc2VydGlvbnMnO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IE1hbnVmYWN0dXJpbmdQbGF0Zm9ybVN0YWNrIH0gZnJvbSAnLi4vbGliL21hbnVmYWN0dXJpbmctcGxhdGZvcm0tc3RhY2snO1xuXG5kZXNjcmliZSgnTWFudWZhY3R1cmluZ1BsYXRmb3JtU3RhY2snLCAoKSA9PiB7XG4gIGxldCBhcHA6IGNkay5BcHA7XG4gIGxldCBzdGFjazogTWFudWZhY3R1cmluZ1BsYXRmb3JtU3RhY2s7XG4gIGxldCB0ZW1wbGF0ZTogVGVtcGxhdGU7XG5cbiAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgYXBwID0gbmV3IGNkay5BcHAoKTtcbiAgICBzdGFjayA9IG5ldyBNYW51ZmFjdHVyaW5nUGxhdGZvcm1TdGFjayhhcHAsICdUZXN0U3RhY2snLCB7XG4gICAgICBlbnZpcm9ubWVudDogJ3Rlc3QnLFxuICAgIH0pO1xuICAgIHRlbXBsYXRlID0gVGVtcGxhdGUuZnJvbVN0YWNrKHN0YWNrKTtcbiAgfSk7XG5cbiAgdGVzdCgnQ3JlYXRlcyBWUEMgd2l0aCBjb3JyZWN0IGNvbmZpZ3VyYXRpb24nLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkVDMjo6VlBDJywge1xuICAgICAgQ2lkckJsb2NrOiAnMTAuMC4wLjAvMTYnLFxuICAgICAgRW5hYmxlRG5zSG9zdG5hbWVzOiB0cnVlLFxuICAgICAgRW5hYmxlRG5zU3VwcG9ydDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIENoZWNrIGZvciBwdWJsaWMsIHByaXZhdGUsIGFuZCBpc29sYXRlZCBzdWJuZXRzXG4gICAgdGVtcGxhdGUucmVzb3VyY2VDb3VudElzKCdBV1M6OkVDMjo6U3VibmV0JywgOSk7IC8vIDMgQVpzIHggMyBzdWJuZXQgdHlwZXNcbiAgfSk7XG5cbiAgdGVzdCgnQ3JlYXRlcyBUaW1lc2NhbGVEQiBpbnN0YW5jZScsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6UkRTOjpEQkluc3RhbmNlJywge1xuICAgICAgREJJbnN0YW5jZUNsYXNzOiAnZGIucjZnLmxhcmdlJyxcbiAgICAgIEVuZ2luZTogJ3Bvc3RncmVzJyxcbiAgICAgIFBvcnQ6IDU0MzMsXG4gICAgICBTdG9yYWdlRW5jcnlwdGVkOiB0cnVlLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdDcmVhdGVzIFBvc3RncmVTUUwgaW5zdGFuY2UnLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OlJEUzo6REJJbnN0YW5jZScsIHtcbiAgICAgIERCSW5zdGFuY2VDbGFzczogJ2RiLnI2Zy54bGFyZ2UnLFxuICAgICAgRW5naW5lOiAncG9zdGdyZXMnLFxuICAgICAgUG9ydDogNTQzMixcbiAgICAgIFN0b3JhZ2VFbmNyeXB0ZWQ6IHRydWUsXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ0NyZWF0ZXMgUzMgYnVja2V0IHdpdGggbGlmZWN5Y2xlIHBvbGljaWVzJywgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpTMzo6QnVja2V0Jywge1xuICAgICAgQnVja2V0RW5jcnlwdGlvbjoge1xuICAgICAgICBTZXJ2ZXJTaWRlRW5jcnlwdGlvbkNvbmZpZ3VyYXRpb246IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBTZXJ2ZXJTaWRlRW5jcnlwdGlvbkJ5RGVmYXVsdDoge1xuICAgICAgICAgICAgICBTU0VBbGdvcml0aG06ICdhd3M6a21zJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICBMaWZlY3ljbGVDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIFJ1bGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgSWQ6ICdBcmNoaXZhbExpZmVjeWNsZScsXG4gICAgICAgICAgICBTdGF0dXM6ICdFbmFibGVkJyxcbiAgICAgICAgICAgIFRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBTdG9yYWdlQ2xhc3M6ICdTVEFOREFSRF9JQScsXG4gICAgICAgICAgICAgICAgVHJhbnNpdGlvbkluRGF5czogMzAsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBTdG9yYWdlQ2xhc3M6ICdHTEFDSUVSJyxcbiAgICAgICAgICAgICAgICBUcmFuc2l0aW9uSW5EYXlzOiA5MCxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFN0b3JhZ2VDbGFzczogJ0RFRVBfQVJDSElWRScsXG4gICAgICAgICAgICAgICAgVHJhbnNpdGlvbkluRGF5czogMzY1LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnQ3JlYXRlcyBNU0sgY2x1c3RlcicsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6TVNLOjpDbHVzdGVyJywge1xuICAgICAgQ2x1c3Rlck5hbWU6ICdtYW51ZmFjdHVyaW5nLWthZmthLXRlc3QnLFxuICAgICAgS2Fma2FWZXJzaW9uOiAnMi44LjEnLFxuICAgICAgTnVtYmVyT2ZCcm9rZXJOb2RlczogMyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnQ3JlYXRlcyBMYW1iZGEgZnVuY3Rpb25zJywgKCkgPT4ge1xuICAgIC8vIFNob3VsZCBjcmVhdGUgNCBMYW1iZGEgZnVuY3Rpb25zXG4gICAgdGVtcGxhdGUucmVzb3VyY2VDb3VudElzKCdBV1M6OkxhbWJkYTo6RnVuY3Rpb24nLCA0KTtcblxuICAgIC8vIENoZWNrIGFsZXJ0IHByb2Nlc3NvciBoYXMgb3B0aW1pemVkIGNvbmZpZ3VyYXRpb25cbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6TGFtYmRhOjpGdW5jdGlvbicsIHtcbiAgICAgIFJ1bnRpbWU6ICdub2RlanMxOC54JyxcbiAgICAgIFRpbWVvdXQ6IDE1LCAvLyA8NTAwbXMgcHJvY2Vzc2luZyByZXF1aXJlbWVudFxuICAgICAgTWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIFJlc2VydmVkQ29uY3VycmVuY3lMaW1pdDogMTAwLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdDcmVhdGVzIEFQSSBHYXRld2F5IHdpdGggQ09SUycsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6QXBpR2F0ZXdheTo6UmVzdEFwaScsIHtcbiAgICAgIE5hbWU6ICdNYW51ZmFjdHVyaW5nIFBsYXRmb3JtIEFQSSAtIHRlc3QnLFxuICAgIH0pO1xuXG4gICAgLy8gQ2hlY2sgZm9yIENPUlMgY29uZmlndXJhdGlvblxuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcygnQVdTOjpBcGlHYXRld2F5OjpNZXRob2QnLCB7XG4gICAgICBIdHRwTWV0aG9kOiAnT1BUSU9OUycsXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ0NyZWF0ZXMgU05TIHRvcGljIGZvciBhbGVydHMnLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OlNOUzo6VG9waWMnLCB7XG4gICAgICBUb3BpY05hbWU6ICdtYW51ZmFjdHVyaW5nLWFsZXJ0cy10ZXN0JyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdCgnQ3JlYXRlcyBDbG91ZFdhdGNoIGFsYXJtcycsICgpID0+IHtcbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6Q2xvdWRXYXRjaDo6QWxhcm0nLCB7XG4gICAgICBUaHJlc2hvbGQ6IDUwMCwgLy8gNTAwbXMgdGhyZXNob2xkIGZvciBhbGVydCBsYXRlbmN5XG4gICAgICBDb21wYXJpc29uT3BlcmF0b3I6ICdHcmVhdGVyVGhhblRocmVzaG9sZCcsXG4gICAgfSk7XG5cbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6Q2xvdWRXYXRjaDo6QWxhcm0nLCB7XG4gICAgICBUaHJlc2hvbGQ6IDUsIC8vIDUlIGVycm9yIHJhdGUgdGhyZXNob2xkXG4gICAgICBDb21wYXJpc29uT3BlcmF0b3I6ICdHcmVhdGVyVGhhblRocmVzaG9sZCcsXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ0NyZWF0ZXMgc2VjdXJpdHkgZ3JvdXBzIHdpdGggcHJvcGVyIHJ1bGVzJywgKCkgPT4ge1xuICAgIC8vIERhdGFiYXNlIHNlY3VyaXR5IGdyb3VwIGFsbG93cyBMYW1iZGEgYWNjZXNzXG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkVDMjo6U2VjdXJpdHlHcm91cEluZ3Jlc3MnLCB7XG4gICAgICBJcFByb3RvY29sOiAndGNwJyxcbiAgICAgIEZyb21Qb3J0OiA1NDMyLFxuICAgICAgVG9Qb3J0OiA1NDMyLFxuICAgIH0pO1xuXG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OkVDMjo6U2VjdXJpdHlHcm91cEluZ3Jlc3MnLCB7XG4gICAgICBJcFByb3RvY29sOiAndGNwJyxcbiAgICAgIEZyb21Qb3J0OiA1NDMzLFxuICAgICAgVG9Qb3J0OiA1NDMzLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KCdDcmVhdGVzIEtNUyBrZXkgZm9yIGVuY3J5cHRpb24nLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OktNUzo6S2V5Jywge1xuICAgICAgRGVzY3JpcHRpb246ICdLTVMgS2V5IGZvciBNYW51ZmFjdHVyaW5nIFBsYXRmb3JtIGVuY3J5cHRpb24nLFxuICAgICAgRW5hYmxlS2V5Um90YXRpb246IHRydWUsXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoJ0NyZWF0ZXMgU1NNIHBhcmFtZXRlcnMnLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OlNTTTo6UGFyYW1ldGVyJywge1xuICAgICAgTmFtZTogJy90ZXN0L21hbnVmYWN0dXJpbmcvdGltZXNjYWxlLWVuZHBvaW50JyxcbiAgICAgIFR5cGU6ICdTdHJpbmcnLFxuICAgIH0pO1xuXG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKCdBV1M6OlNTTTo6UGFyYW1ldGVyJywge1xuICAgICAgTmFtZTogJy90ZXN0L21hbnVmYWN0dXJpbmcvcG9zdGdyZXMtZW5kcG9pbnQnLFxuICAgICAgVHlwZTogJ1N0cmluZycsXG4gICAgfSk7XG5cbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6U1NNOjpQYXJhbWV0ZXInLCB7XG4gICAgICBOYW1lOiAnL3Rlc3QvbWFudWZhY3R1cmluZy9rYWZrYS1ib290c3RyYXAtc2VydmVycycsXG4gICAgICBUeXBlOiAnU3RyaW5nJyxcbiAgICB9KTtcbiAgfSk7XG5cbiAgZGVzY3JpYmUoJ1NpbmdsZS10ZW5hbnQgY29uZmlndXJhdGlvbicsICgpID0+IHtcbiAgICBiZWZvcmVFYWNoKCgpID0+IHtcbiAgICAgIHN0YWNrID0gbmV3IE1hbnVmYWN0dXJpbmdQbGF0Zm9ybVN0YWNrKGFwcCwgJ1NpbmdsZVRlbmFudFN0YWNrJywge1xuICAgICAgICBlbnZpcm9ubWVudDogJ3Rlc3QnLFxuICAgICAgICB0ZW5hbnRJZDogJ3RlbmFudC0xMjMnLFxuICAgICAgfSk7XG4gICAgICB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCdDcmVhdGVzIHRlbmFudC1zcGVjaWZpYyByZXNvdXJjZXMnLCAoKSA9PiB7XG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6TVNLOjpDbHVzdGVyJywge1xuICAgICAgICBDbHVzdGVyTmFtZTogJ21hbnVmYWN0dXJpbmcta2Fma2EtdGVuYW50LTEyMy10ZXN0JyxcbiAgICAgIH0pO1xuXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6U05TOjpUb3BpYycsIHtcbiAgICAgICAgVG9waWNOYW1lOiAnbWFudWZhY3R1cmluZy1hbGVydHMtdGVuYW50LTEyMy10ZXN0JyxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGVzdCgnVXNlcyBzbWFsbGVyIFBvc3RncmVTUUwgaW5zdGFuY2UgZm9yIHNpbmdsZSB0ZW5hbnQnLCAoKSA9PiB7XG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoJ0FXUzo6UkRTOjpEQkluc3RhbmNlJywge1xuICAgICAgICBEQkluc3RhbmNlQ2xhc3M6ICdkYi5yNmcubGFyZ2UnLCAvLyBTbWFsbGVyIGluc3RhbmNlIGZvciBzaW5nbGUgdGVuYW50XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59KTsiXX0=