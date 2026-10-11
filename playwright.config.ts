import path from "node:path";
import { defineConfig } from "@playwright/test";
const testDbPath = path.resolve(process.cwd(), ".data/employee360.test.sqlite");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  timeout: 30_000,
  reporter: [["line"], ["allure-playwright"]],
  use: {
    baseURL: "http://127.0.0.1:4010"
  },
  webServer: {
    command: "npm run service:start",
    url: "http://127.0.0.1:4010/health",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      PORT: "4010",
      EMPLOYEE_DB_PATH: testDbPath
    }
  }
});
