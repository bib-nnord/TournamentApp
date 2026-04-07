import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

type User = {
  username: string;
  password: string;
};

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:2000";

function testUsers(): { userA: User; userB: User } {
  return {
    userA: { username: "hannahfox", password: "hannahfox" },
    userB: { username: "diegovarela", password: "diegovarela" },
  };
}

async function loginUser(request: APIRequestContext, user: User) {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: {
      username: user.username,
      password: user.password,
    },
  });
  expect(res.ok()).toBeTruthy();
}

async function logout(request: APIRequestContext) {
  await request.post(`${API_URL}/auth/logout`);
}

test.describe.configure({ mode: "serial" });

test("add friend", async ({ page }) => {
  const { userA, userB } = testUsers();

  await loginUser(page.request, userA);
  await page.goto("/friends");

  await page.getByPlaceholder("Search users...").fill(userB.username);
  await page.waitForTimeout(50);

  await page.getByRole("button", { name: "Send request" }).click();

  await expect(page.getByText(`Friend request sent to ${userB.username}.`)).toBeVisible();

  await logout(page.request);
  await loginUser(page.request, userB);

  await page.goto("/friends");

  await page.getByText("Accept").first().click();

  await expect(page.getByText("accepted")).toBeVisible();
});

test("send message", async ({ page }) => {
  const { userA, userB } = testUsers();

  await loginUser(page.request, userA);
  await page.goto("/messages");

  await page.getByText("new message").click();
  await page.getByPlaceholder("Search users...").fill(userB.username);
  await page.waitForTimeout(50);

  await page.getByText(userB.username).first().click();


  const messageText = "Hello";
  await page.getByPlaceholder("Write your message…").fill(messageText);
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(messageText)).toBeVisible();

  await logout(page.request);
  await loginUser(page.request, userB);

  await page.goto("/messages");

  await expect(page.getByText(messageText)).toBeVisible();
});
