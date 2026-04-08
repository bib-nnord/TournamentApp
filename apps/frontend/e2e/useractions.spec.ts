import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

type User = { username: string; password: string };

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:2000";

const userA: User = { username: "hannahfox", password: "hannahfox" };
const userB: User = { username: "diegovarela", password: "diegovarela" };

async function logout(page: Page) {
  await page.locator("header button[aria-haspopup='menu']").click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
}


async function login(page: Page, user: User) {
  await page.goto("/login");
  await page.getByLabel("Username or email").fill(user.username);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe.configure({ mode: "serial" });

test("add friend, accept, message, unfriend", async ({ page }) => {


  // a requests b then logs out
  await login(page, userA);
  await page.goto("/friends");
  await page.getByPlaceholder("Search users...").fill(userB.username);
  await page.getByText(userB.username).click();
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText(`Friend request sent to ${userB.username}`)).toBeVisible();
  await logout(page);
  // b logs in and accepts
  await login(page, userB);
  await page.goto("/friends");
  await page.getByText("Incoming requests");
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText(`You are now friends with ${userA.username}`)).toBeVisible();
  // b sends message to a
  await page.goto("/messages");
  await page.getByText("New message").click();
  await page.getByPlaceholder("Search for a user…").fill(userA.username);
  await page.getByText(userA.username).click();
  await page.getByPlaceholder("Subject").fill("Hallo");
  await page.getByPlaceholder("Write your message…").fill("Hallo 2");
  await page.getByRole("button", { name: "Send" }).click();
  await logout(page)

  // a checks for the message
  await login(page, userA);
  await page.goto("/messages");

  await expect(page.getByText("Hallo", { exact: true })).toBeVisible();

  // a deletes
  await page.getByText("Hallo").first().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Hallo")).not.toBeVisible();

  // change to b and unfriend
  await logout(page);
  await login(page, userB);
  await page.goto("/friends");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove" }).click();
  await page.goto("/messages");
  await page.getByText("Sent").first().click();
  await expect(page.getByText("Hallo", { exact: true })).toBeVisible();
  await page.getByText("Hallo").first().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Hallo")).not.toBeVisible();
  await logout(page);
});
