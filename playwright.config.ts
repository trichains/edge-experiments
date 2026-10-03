import { defineConfig, devices } from "@playwright/test";

const PORT = 3102;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Runs against the production build: `npm run build` first (CI does this in the e2e job).
  webServer: {
    command: "npm run start",
    url: `http://localhost:${PORT}/api/config`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
