import { defineConfig } from "@playwright/test";

process.env.BASE_URL = "https://qa-1.ada.test";
process.env.DB_URL = "";

export default defineConfig({
  testDir: "..",
  retries: 1,
  reporter: [["list"], ["json", { outputFile: "playwright-report.json" }]],
  projects: [
    { name: "head", use: { baseURL: "https://qa-1.ada.test" } }
  ]
});
