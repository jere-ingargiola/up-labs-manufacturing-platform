// AWS API Gateway event and response types
// Centralized to avoid duplication across Lambda handlers

export interface APIGatewayProxyEvent {
  body?: string;
  pathParameters?: { [name: string]: string } | null;
  queryStringParameters?: { [name: string]: string } | null;
  headers?: { [name: string]: string };
  requestContext?: {
    requestId: string;
    identity?: {
      sourceIp: string;
      userAgent?: string;
    };
    httpMethod: string;
    resourcePath: string;
    stage: string;
  };
  multiValueHeaders?: { [name: string]: string[] };
  multiValueQueryStringParameters?: { [name: string]: string[] };
  stageVariables?: { [name: string]: string } | null;
  resource: string;
  httpMethod: string;
  path: string;
  isBase64Encoded: boolean;
}

export interface APIGatewayProxyResult {
  statusCode: number;
  headers?: { [header: string]: boolean | number | string };
  multiValueHeaders?: { [header: string]: (boolean | number | string)[] };
  body: string;
  isBase64Encoded?: boolean;
}