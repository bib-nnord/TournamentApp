import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

type User = { username: string; password: string };

const API = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:2000";

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

/** Clean up any existing friendship/request between userA and userB, and leftover test messages. */
async function cleanupState(request: APIRequestContext) {
  for (const user of [userA, userB]) {
    // Log in via API
    await request.post(`${API}/auth/login`, {
      data: { username: user.username, password: user.password },
    });

    // Remove friendship / pending request if it exists
    const statusRes = await request.get(
      `${API}/friends/status/${user === userA ? userB.username : userA.username}`
    );
    if (statusRes.ok()) {
      const { status, friendshipId } = await statusRes.json();
      if (friendshipId && status !== "none" && status !== "self") {
        await request.delete(`${API}/friends/${friendshipId}`);
      }
    }

    // Delete any "Hallo" test messages (inbox + sent)
    for (const folder of ["inbox", "sent"]) {
      const msgRes = await request.get(`${API}/messages?folder=${folder}&limit=50`);
      if (msgRes.ok()) {
        const { messages } = await msgRes.json();
        for (const msg of messages) {
          if (msg.subject === "Hallo") {
            await request.delete(`${API}/messages/${msg.id}`);
          }
        }
      }
    }

    await request.post(`${API}/auth/logout`);
  }
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await cleanupState(request);
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
