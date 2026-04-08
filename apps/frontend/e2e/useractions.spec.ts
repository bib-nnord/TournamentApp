import { test, expect, type Page } from "@playwright/test";

type User = { username: string; password: string };

const userA: User = { username: "hannahfox", password: "hannahfox" };
const userB: User = { username: "diegovarela", password: "diegovarela" };

async function logout(page: Page) {
  await page.locator("header button[aria-haspopup='menu']").click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  await page.waitForURL("**/login");
}


async function login(page: Page, user: User) {
  await page.goto("/login");
  const usernameField = page.getByLabel("Username or email");
  const passwordField = page.getByLabel("Password");
  await usernameField.click();
  await usernameField.fill(user.username);
  await passwordField.click();
  await passwordField.fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

/** Clean up any existing friendship/request and leftover test messages via the UI. */
async function cleanupViaUI(page: Page) {
  for (const user of [userA, userB]) {
    await login(page, user);

    // Clean up friend state
    await page.goto("/friends");
    await page.waitForLoadState("networkidle");

    // Remove accepted friendship (opens a confirmation modal)
    const removeBtn = page.getByRole("button", { name: "Remove" }).first();
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click();
      // Confirm in the modal
      await page.locator("[class*='bg-red-600']").getByText("Remove").click();
      await page.waitForLoadState("networkidle");
    }

    // Reload to get fresh state after possible removal
    await page.goto("/friends");
    await page.waitForLoadState("networkidle");

    // Cancel outgoing pending request (button is in the "Pending" section, not a modal)
    const cancelBtn = page.getByRole("button", { name: "Cancel" }).first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await page.waitForLoadState("networkidle");
    }

    // Decline incoming pending request
    const declineBtn = page.getByRole("button", { name: "Decline" }).first();
    if (await declineBtn.isVisible().catch(() => false)) {
      await declineBtn.click();
      await page.waitForLoadState("networkidle");
    }

    // Clean up test messages in inbox and sent
    for (const folder of ["Inbox", "Sent"]) {
      await page.goto("/messages");
      if (folder === "Sent") {
        const sentTab = page.getByText("Sent").first();
        if (await sentTab.isVisible().catch(() => false)) await sentTab.click();
      }
      while (await page.getByText("Hallo", { exact: true }).isVisible().catch(() => false)) {
        await page.getByText("Hallo", { exact: true }).first().click();
        await page.getByRole("button", { name: "Delete" }).click();
      }
    }

    await logout(page);
  }
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await cleanupViaUI(page);
});

test("add friend, accept, message, unfriend", async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  // a requests b then logs out
  await login(page, userA);
  await page.goto("/friends");
  await page.getByPlaceholder("Search users...").fill(userB.username);
  // Wait for dropdown results, then select via keyboard to avoid ambiguous text matches
  await page.locator(".absolute.z-30 button").first().waitFor();
  await page.getByPlaceholder("Search users...").press("ArrowDown");
  await page.getByPlaceholder("Search users...").press("Enter");
  await expect(page.getByRole("button", { name: "Send request" })).toBeEnabled();
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
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Hallo")).not.toBeVisible();

  // change to b and unfriend
  await logout(page);
  await login(page, userB);
  await page.goto("/friends");
  await page.getByRole("button", { name: "Remove" }).click();
  await page.goto("/messages");
  await page.getByText("Sent").first().click();
  await expect(page.getByText("Hallo", { exact: true })).toBeVisible();
  await page.getByText("Hallo").first().click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Hallo")).not.toBeVisible();
  await logout(page);
});
