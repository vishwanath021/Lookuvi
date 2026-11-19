import type { Page, TestInfo } from "@playwright/test";

/** Playwright output dir only — never write under /opt/cursor. */
export async function safeScreenshot(
  page: Page,
  testInfo: TestInfo,
  fileName: string,
  options?: Parameters<Page["screenshot"]>[0],
) {
  try {
    await page.screenshot({ path: testInfo.outputPath(fileName), ...options });
  } catch {
    // Output dir missing or read-only in some environments.
  }
}