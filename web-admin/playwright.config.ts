import { defineConfig } from "@playwright/test";

export default defineConfig({
  timeout: 30_000,
  projects: [
    {
      name: "mocked-ui",
      testDir: "./tests/e2e",
      use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
      }
    },
    {
      name: "live-api",
      testDir: "./tests/live",
      use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
      }
    }
  ]
});
