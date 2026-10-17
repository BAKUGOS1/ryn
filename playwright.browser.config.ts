import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 } } },
  ],
});
