/// <reference path="./worker-configuration.d.ts" />
declare module 'h3' {
  interface H3EventContext {
    cloudflare: {
      env: Env;
    };
  }
}

export {};
