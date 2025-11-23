# up-labs-manufacturing-platform

## Custom Manufacturing Platform

## Business & Technical Context Summary

## Business Context

**Company:** UP.Labs (new venture)

**Core Platform Capabilities:**

* Connects to IoT sensors on manufacturing equipment and assembly lines
* Provides real-time production monitoring and predictive maintenance
* Optimizes custom part manufacturing schedules using complex BOMs
* Tracks quality metrics and compliance for critical components
* Enables collaboration between engineering, production, and supply chain teams

**Business Model:** SaaS subscription, priced by number of production lines and data volume processed

**Current Status:**

* Pre-revenue, 24-month runway
* 1 Fortune 500 beta customer (heavy equipment manufacturer)
* Target: 3 enterprise customers in first 18 months
* Each customer: 5–15 production facilities across North America

## Technical Challenge

### Data Latency vs. Cost

* Shop floor safety alerts must be processed within 500ms
* Historical analytics can tolerate up to 5-minute delays
* Data volume: 10TB/month per facility
* Infrastructure budget: must stay under $50K/month at 3 customers

#### Decision: Data Latency Strategy

Real-time safety alerts: Use edge processing and a low-latency stream pipeline (e.g., Kafka + Flink) to ensure <500ms event response.
Historical analytics: Batch ETL jobs every 5 minutes to a data lake (e.g., AWS S3) and query via scalable analytics engines (e.g., Athena, Redshift).

#### Trade-Offs: Data Latency

Edge/stream processing increases infrastructure complexity and cost, but is essential for safety and compliance.
Batch analytics reduces compute costs and allows for larger, cheaper storage, but sacrifices immediacy for non-critical insights.

### Multi-Tenancy Architecture

* Option A: Shared infrastructure with logical separation
* Option B: Isolated environments per customer
* Option C: Hybrid approach
* Considerations: Security (defense contractors), compliance (ITAR), performance isolation, cost, operational complexity

#### Decision: Multi-Tenancy Approach

**Hybrid approach:** Shared core infrastructure for efficiency, with isolated VPCs and dedicated encryption keys per customer for compliance and security.

#### Trade-Offs: Multi-Tenancy

Shared infrastructure lowers cost and simplifies scaling, but increases risk of cross-tenant data exposure.
Isolated environments improve security and compliance (ITAR, defense contractors), but increase operational complexity and cost.

Hybrid balances cost, security, and operational overhead, but requires careful design and ongoing management.

### Technology Stack Selection

* Database(s)
* Stream processing
* AI/ML platform
* Application layer
* API layer
* Other critical infrastructure/tools

#### Database(s)

Time-series DB (TimescaleDB): For sensor data.
Relational DB (PostgreSQL): For transactional data (BOMs, schedules).
Data Lake (AWS S3): For raw and historical analytics.

#### Stream Processing

* Kafka (MSK) + Flink: For real-time event handling and anomaly detection.

#### AI/ML Platform

* AWS SageMaker: or predictive maintenance and schedule optimization.

#### Application Layer

* Containerized microservices (EKS/Kubernetes): For scalability and modularity.
* Frontend: React.js for dashboards and collaboration tools.

#### API Layer (Technology Stack)

* API Gateway (REST/GraphQL): For secure, scalable access.

#### Other Infrastructure

* CloudWatch + SNS: For monitoring and alerting.
* Grafana: For visualization and dashboards.

#### Trade-Offs: Technology Stack

* Managed cloud services (AWS MSK, SageMaker, EKS) reduce operational burden but may increase vendor lock-in and cost.
* Open-source alternatives can lower cost but require more maintenance and expertise.
* Microservices improve scalability and resilience, but add complexity to deployment and monitoring.

### Security & Compliance

#### Decision

* VPC isolation, IAM roles, KMS encryption, audit logging, and regular security reviews.

#### Trade-Offs: Security & Compliance

* Stronger security may slow down development and increase costs, but is essential for defense and ITAR compliance.

### Stream Processing Decision for MIP

#### Requirements

* Real-time ingestion and processing of IoT sensor data from manufacturing equipment and assembly lines.
* Safety alerts must be processed within 500ms.
* Scalable to handle high data volumes (10TB/month/facility).
* Integration with TimescaleDB for storage and downstream analytics.

#### Recommended Solution: Apache Kafka + Apache Flink (Managed on AWS)

##### Why Kafka (AWS MSK)?

* High-throughput, low-latency event streaming.
* Durable message storage and replay for reliability.
* Scalable: Easily handles thousands of events per second.
* Integration: Works well with Flink, TimescaleDB, and other analytics tools.
* Managed Service: AWS MSK reduces operational overhead.

##### Why Flink (AWS Kinesis Data Analytics or Self-Managed)?

* Real-time processing: Detect anomalies, trigger safety alerts, and enrich data streams.
* Complex event processing: Windowing, aggregations, and pattern detection.
* Low-latency: Designed for sub-second event handling.
* Scalable: Can process streams from multiple facilities in parallel.

##### Data Flow Example

* IoT sensors send data to a webhook endpoint.
* Webhook pushes events into a Kafka topic (MSK).
* Flink consumes events from Kafka, processes them in real time:
  * Detects anomalies (e.g., temperature spikes, vibration outliers).
  * Triggers safety alerts if thresholds are exceeded.
  * Writes processed events to TimescaleDB for storage and analytics.
  * Sends notifications to application layer or monitoring tools (CloudWatch/SNS).

#### Trade-Offs

* Managed services (MSK, Kinesis Data Analytics) reduce operational burden but increase cost and vendor lock-in.
* Self-managed Flink/Kafka can lower costs but require more DevOps expertise.
* Kafka + Flink is a proven, scalable combo for industrial IoT, but alternatives (e.g., AWS Kinesis Streams + Lambda) may be considered for simpler use cases.

### AI/ML Integration

The platform leverages AWS SageMaker for predictive maintenance, anomaly detection, and schedule optimization.

* Model Training: SageMaker trains models using historical sensor and production data stored in S3 and TimescaleDB.
* Real-Time Inference: Flink and Lambda functions invoke SageMaker endpoints to perform real-time anomaly detection and predictive analytics on incoming sensor data.
* Batch Analytics: Scheduled jobs use SageMaker for deeper analysis and optimization, with results stored in TimescaleDB or S3 for reporting and dashboarding.
* Extensibility: The architecture supports integration with other ML platforms or custom EC2-based ML stacks if needed.

#### API Layer

The platform exposes secure, scalable APIs for internal and external clients:

API Gateway provides RESTful and/or GraphQL endpoints for:

* Equipment status queries
* Production metrics retrieval
* Alert history access
* Integration with engineering, production, and supply chain systems

Lambda Functions handle business logic, authentication, and data aggregation behind the API endpoints.
Security: All APIs are protected with IAM roles, API keys, and VPC isolation as appropriate.

#### Monitoring & Alerting

Robust monitoring and alerting are built in to ensure reliability and rapid incident response:

* AWS CloudWatch collects metrics, logs, and events from all major components (Lambda, EC2, Kafka, Flink, SageMaker).
* SNS (Simple Notification Service) delivers real-time alerts to operations teams via email, SMS, or integrated chat tools.
* Grafana provides interactive dashboards for visualizing equipment status, production metrics, and alert history, connecting to TimescaleDB/Postgres and Athena.
* Audit Logging: CloudTrail records API calls and changes for compliance and troubleshooting.

#### Security & Compliance (Details)

Security and regulatory compliance are core to the platform’s design:

* VPC Isolation: Each customer’s data and compute resources are isolated in dedicated VPCs.
* IAM Roles: Fine-grained access control for all AWS resources and services.
* KMS Encryption: All sensitive data is encrypted at rest and in transit using AWS Key Management Service.
* Audit Logging: CloudTrail and CloudWatch provide comprehensive logging and monitoring for all activities.
* Compliance: Regular security reviews and adherence to ITAR and defense contractor requirements.

## Code

### Sample IoT Payload

```json
{
  "equipment_id": "EQ-123",
  "timestamp": "2025-11-23T14:00:00Z",
  "temperature": 78.5,
  "vibration": 0.12,
  "pressure": 101.3
}
```

### Anomoly Detection Alogorithm

In this example the thresholds are global for all machines, however, ideally these would be configured by machine (or machine model).

Current thresholds are temperature  > 90°C, vibration > 0.2.

### Endpoints

* equipment/{id}/status: Latest sensor readings and current alert state

* /equipment/{id}/metrics: Historical metrics (with optional time range)

* /equipment/{id}/alerts: Alert history (with filters for status, time, etc.)

## Folder Structure

production-line-monitor/
├── lambdas/                          # Lambda functions for API endpoints
│   ├── ingestSensorData/             # POST /webhook/sensor-data
│   │   ├── handler.ts
│   │   ├── anomaly.ts
│   │   ├── models.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   ├── getEquipmentStatus/           # GET /equipment/{id}/status
│   │   ├── handler.ts
│   │   ├── models.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   ├── getEquipmentMetrics/          # GET /equipment/{id}/metrics
│   │   ├── handler.ts
│   │   ├── models.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   ├── getEquipmentAlerts/           # GET /equipment/{id}/alerts
│   │   ├── handler.ts
│   │   ├── models.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   ├── transactionalOps/             # For transactional endpoints (BOMs, schedules, etc.)
│   │   ├── handler.ts
│   │   ├── models.ts
│   │   ├── tsconfig.json
│   │   ├── package.json
│   ├── shared/                       # Shared code for DB/S3 access
│   │   ├── database.ts               # TimescaleDB/Postgres connection logic
│   │   ├── s3Utils.ts                # S3 access helpers
│   │   ├── models.ts                 # Shared interfaces/types
│   │   ├── config.ts                 # Env/config management
│   │   ├── tsconfig.json
│   │   ├── package.json
├── flink/                            # Flink job code/configs (Java/Scala/TypeScript for config/scripts)
│   ├── job.java                      # Flink pipeline for event routing (Java/Scala)
│   ├── config.yaml                   # Flink job configuration
│   └── README.md
├── infra/                            # AWS CDK infrastructure as code (TypeScript)
│   ├── bin/
│   │   └── cdk.ts                    # CDK app entry point
│   ├── lib/
│   │   └── monitor-stack.ts          # Main CDK stack definition
│   ├── package.json
│   ├── tsconfig.json
│   ├── cdk.json
│   └── README.md
├── tests/                            # Unit and integration tests (Jest or similar)
│   ├── ingestSensorData.test.ts
│   ├── getEquipmentStatus.test.ts
│   ├── getEquipmentMetrics.test.ts
│   ├── getEquipmentAlerts.test.ts
│   ├── transactionalOps.test.ts
│   ├── anomaly.test.ts
│   └── s3Utils.test.ts
├── Dockerfile                        # For local Lambda dev (optional)
├── docker-compose.yml                # Local dev orchestration (optional)
├── package.json                      # Top-level dependencies/scripts (if needed)
├── tsconfig.json                     # Top-level TypeScript config (if needed)
├── .env.example                      # Example environment variables
├── README.md                         # Project overview & API docs
└── .gitignore                        # Git ignore file
