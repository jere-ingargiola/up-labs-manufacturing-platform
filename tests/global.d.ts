// Global test type declarations

declare global {
  namespace NodeJS {
    interface Global {
      testUtils: {
        createMockAPIGatewayEvent: (overrides?: any) => any;
        createMockTenantContext: (overrides?: any) => any;
      };
    }
  }
}

export {};