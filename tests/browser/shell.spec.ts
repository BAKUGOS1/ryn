import { test, expect } from "@playwright/test";
test("preview navigation and no horizontal overflow", async ({ page }) => {
  await page.goto("/preview");
  await expect(
    page.getByRole("heading", { name: "Your workspace, in focus." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Members", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A place for your people." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Make your workspace yours." }),
  ).toBeVisible();
});
test("setup mode does not expose a working sign-in form", async ({ page }) => {
  await page.goto("/auth/login");
  await expect(
    page.getByText("Authentication is not connected", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
});

test("public guide and sample workflow form a clear mobile-safe journey", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await page.getByText("What is FutureFlow?", { exact: true }).click();
  await expect(
    page.getByText("FutureFlow helps small teams", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(
    page.getByRole("heading", { name: "Get started with FutureFlow" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Try the sample editor" }).click();
  await page.getByRole("button", { name: "Open visual editor" }).click();
  await expect(
    page.getByRole("region", { name: "Workflow editor" }),
  ).toBeVisible();
});
