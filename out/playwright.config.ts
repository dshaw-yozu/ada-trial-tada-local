import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "..",
  retries: 1,
  reporter: [["list"], ["json", { outputFile: "playwright-report.json" }]],
  projects: [
    { name: "head", use: { baseURL: "https://qa-1.ada.test" } }
  ]
});
