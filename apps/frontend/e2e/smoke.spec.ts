import { test, expect } from "@playwright/test";

test("homepage loads successfully", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
});

test("login page is accessible", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL("/login");
});

test("register page is accessible", async ({ page }) => {
  await page.goto("/register");
  await expect(page).toHaveURL("/register");
});
