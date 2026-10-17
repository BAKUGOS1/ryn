import { test, expect } from "@playwright/test";
test("edits and simulates the shared workflow contract without external effects", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/"))
      mutations.push(request.url());
  });
  await page.goto("/preview?tab=studio");
  const open = page.getByRole("button", { name: "Open visual editor" });
  await open.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Workflow editor" }),
  ).toBeVisible();
  await expect(
    page.getByText("Valid workflow · 2 steps · One immutable contract"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sample · saving disabled" }),
  ).toBeDisabled();
  await page
    .getByText("Test safely with a sample event", { exact: true })
    .click();
  await page.getByRole("button", { name: "Simulate draft" }).click();
  await expect(
    page.getByText("Action path reached", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Sample JSON").fill('{"priority":"low"}');
  await page.getByRole("button", { name: "Simulate draft" }).click();
  await expect(
    page.getByText("No action path reached", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Condition", exact: true }).click();
  await expect(
    page.getByText("Resolve before saving", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove selected step" }).click();
  await expect(
    page.getByText("Valid workflow · 2 steps · One immutable contract"),
  ).toBeVisible();
  await page.getByLabel("Comparison").selectOption("gt");
  await page.getByLabel("Expected value as JSON").fill("5");
  await page.getByLabel("Sample JSON").fill('{"priority":6}');
  await page.getByRole("button", { name: "Simulate draft" }).click();
  await expect(
    page.getByText("Action path reached", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Expected value as JSON").fill("invalid json");
  await expect(
    page.getByRole("button", { name: "Simulate draft" }),
  ).toBeDisabled();
  expect(mutations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
