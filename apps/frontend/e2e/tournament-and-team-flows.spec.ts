import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

type SeedUser = {
  username: string;
  password: string;
};

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:2000";

function randomSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function usersForProject(projectName: string): { tournamentOwner: SeedUser; teamOwner: SeedUser; teamMember: SeedUser } {
  if (projectName === "chromium") {
    return {
      tournamentOwner: { username: "marcuswebb", password: "marcuswebb" },
      teamOwner: { username: "carlaromero", password: "carlaromero" },
      teamMember: { username: "lenafischer", password: "lenafischer" },
    };
  }
  if (projectName === "firefox") {
    return {
      tournamentOwner: { username: "ravimehta", password: "ravimehta" },
      teamOwner: { username: "zoepearce", password: "zoepearce" },
      teamMember: { username: "oscarlindqvist", password: "oscarlindqvist" },
    };
  }

  return {
    tournamentOwner: { username: "hannahfox", password: "hannahfox" },
    teamOwner: { username: "diegovarela", password: "diegovarela" },
    teamMember: { username: "samkowalski", password: "samkowalski" },
  };
}

async function loginUser(request: APIRequestContext, user: SeedUser) {
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

async function selectFirstDiscipline(page: Page) {
  await page.getByRole("combobox").first().click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
}

test.describe.configure({ mode: "serial" });

test("create quick tournament with participants and delete it", async ({ page }, testInfo) => {
  const { tournamentOwner } = usersForProject(testInfo.project.name);
  const tournamentName = `E2E Tournament ${randomSuffix()}`;

  await loginUser(page.request, tournamentOwner);

  await page.goto("/tournaments/create/quick");

  await page.getByPlaceholder("Enter an epic tournament name...").fill(tournamentName);
  await selectFirstDiscipline(page);

  const participantInput = page.getByPlaceholder("Enter participant name");
  await participantInput.fill("Guest Alpha");
  await participantInput.press("Enter");
  await participantInput.fill("Guest Beta");
  await participantInput.press("Enter");

  await expect(page.getByText("Guest Alpha")).toBeVisible();
  await expect(page.getByText("Guest Beta")).toBeVisible();

  await page.getByRole("button", { name: "Generate Bracket" }).click();
  await page.getByRole("button", { name: "Confirm & Start Tournament" }).click();

  await expect(page).toHaveURL(/\/tournaments\/view\/\d+$/);
  await expect(page.getByRole("heading", { name: tournamentName })).toBeVisible();
  await expect(page.getByText("Guest Alpha").first()).toBeVisible();
  await expect(page.getByText("Guest Beta").first()).toBeVisible();

  await page.getByRole("button", { name: "Delete tournament" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();

  await expect(page).toHaveURL(/\/tournaments$/);
  await expect(page.getByRole("heading", { name: "Tournaments" })).toBeVisible();
});

test("join and leave a team", async ({ page }, testInfo) => {
  const { teamOwner, teamMember } = usersForProject(testInfo.project.name);
  const teamName = `E2E Team ${randomSuffix()}`;

  await loginUser(page.request, teamOwner);
  const createTeamRes = await page.request.post(`${API_URL}/teams`, {
    data: {
      name: teamName,
      description: "Team created by e2e test",
      disciplines: ["Chess"],
      open: true,
    },
  });
  expect(createTeamRes.ok()).toBeTruthy();
  const createdTeam = await createTeamRes.json();
  const teamId = createdTeam.team.id as number;

  await logout(page.request);
  await loginUser(page.request, teamMember);

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto(`/teams/${teamId}`);
  await expect(page.getByRole("heading", { name: teamName })).toBeVisible();

  await page.getByRole("button", { name: "Join team" }).click();
  await expect(page.getByRole("button", { name: "Leave team" })).toBeVisible();

  await page.getByRole("button", { name: "Leave team" }).click();
  await expect(page.getByRole("button", { name: "Join team" })).toBeVisible();
});
