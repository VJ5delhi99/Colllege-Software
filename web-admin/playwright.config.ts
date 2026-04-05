import { defineConfig } from "@playwright/test";

const managedBaseUrl = "http://127.0.0.1:3100";

export default defineConfig({
  timeout: 30_000,
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run build && node .\\node_modules\\next\\dist\\bin\\next start -p 3100",
        url: managedBaseUrl,
        reuseExistingServer: false,
        timeout: 180_000
      },
  projects: [
    {
      name: "mocked-ui",
      testDir: "./tests/e2e",
      use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? managedBaseUrl
      }
    },
    {
      name: "live-api",
      testDir: "./tests/live",
      use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? managedBaseUrl
      }
    }
  ]
});
