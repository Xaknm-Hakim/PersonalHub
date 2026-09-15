import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const baseURL = process.env.PERSONALHUB_BROWSER_URL;
const ownerPassword = process.env.PERSONALHUB_BROWSER_OWNER_PASSWORD;
if (!baseURL || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL))
  throw new Error("PERSONALHUB_BROWSER_URL must be an explicit loopback URL.");
if (!ownerPassword) throw new Error("Browser owner password is required.");
const modulePath = process.env.PLAYWRIGHT_MODULE;
const playwrightModule = modulePath
  ? await import(pathToFileURL(modulePath).href)
  : await import("playwright");
const { chromium } = playwrightModule.default ?? playwrightModule;
const artifacts = "/tmp/personalhub-browser-smoke";
mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL });
const page = await context.newPage();
const errors = [];
const requests = [];
let capturedServerAction;
let captureProtectedActions = false;
page.on("request", (request) => {
  const actionId = request.headers()["next-action"];
  const body = request.postDataBuffer();
  if (captureProtectedActions && !capturedServerAction && actionId && body) {
    capturedServerAction = {
      actionId,
      body,
      contentType: request.headers()["content-type"]
    };
  }
});
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
page.on("response", (response) => {
  if (response.request().method() !== "GET")
    requests.push(
      `${response.request().method()} ${response.url()} -> ${response.status()} headers=${JSON.stringify({ contentType: response.headers()["content-type"], actionRevalidated: response.headers()["x-action-revalidated"] })}`
    );
});
page.on("requestfinished", async (request) => {
  if (request.method() === "GET") return;
  const response = await request.response();
  const body = await response?.body().catch(() => undefined);
  const bodyText = body?.toString("utf8") ?? "";
  const markers = [
    repeatedTask,
    editedTask,
    projectTitle,
    assignmentTitle,
    noteTitle
  ]
    .filter((marker) => bodyText.includes(marker))
    .map((marker) => marker.replace(unique, "<unique>"));
  requests.push(
    `FINISHED ${request.method()} ${request.url()} bytes=${body?.byteLength ?? "unknown"} markers=${JSON.stringify(markers)}`
  );
});
page.on("requestfailed", (request) =>
  requests.push(
    `${request.method()} ${request.url()} -> ${request.failure()?.errorText}`
  )
);
const unique = `${Date.now()}-${process.pid}`;
const repeatedTask = `Repeated capture ${unique}`;
const editedTask = `${repeatedTask} edited twice`;
const projectTitle = `Project ${unique}`;
const assignmentTitle = `Assignment ${unique}`;
const tagName = `tag-${unique}`;
const noteTitle = `Note ${unique}`;
const apiTokenName = `Browser API ${unique}`;
let apiAuthorization;

async function json(path, init) {
  const response = await context.request.fetch(path, {
    ...init,
    headers: {
      ...(apiAuthorization ? { authorization: apiAuthorization } : {}),
      ...init?.headers
    }
  });
  const body = await response.json();
  return { response, body };
}

async function goto(path) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

try {
  const health = await json("/api/health");
  assert.equal(health.response.status(), 200);
  assert.deepEqual(health.body, { status: "ok" });
  const healthHeaders = health.response.headers();
  assert.equal(healthHeaders["x-content-type-options"], "nosniff");
  assert.match(healthHeaders["content-security-policy"], /nonce-[^' ]+/);
  assert.match(
    healthHeaders["content-security-policy"],
    /frame-ancestors 'none'/
  );
  assert.equal(healthHeaders["referrer-policy"], "no-referrer");
  assert.match(healthHeaders["permissions-policy"], /camera=\(\)/);
  assert.equal(healthHeaders["x-frame-options"], "DENY");
  assert.equal(healthHeaders["access-control-allow-origin"], undefined);
  assert.equal(healthHeaders["strict-transport-security"], undefined);
  const anonymousApi = await json("/api/v1/today");
  assert.equal(anonymousApi.response.status(), 401);
  await goto("/");
  await page.waitForURL(/\/login$/);
  await page.getByRole("heading", { name: "Sign in to PersonalHub" }).waitFor();
  await page.getByLabel("Owner password").fill("incorrect password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("alert").filter({ hasText: "incorrect" }).waitFor();
  await page.getByLabel("Owner password").fill(ownerPassword);
  await Promise.all([
    page.waitForURL(`${baseURL}/`),
    page.getByRole("button", { name: "Sign in" }).click()
  ]);
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  const sessionCookie = (await context.cookies()).find((cookie) =>
    cookie.name.endsWith("personalhub_session")
  );
  assert.ok(sessionCookie);
  assert.equal(sessionCookie.name, "__Host-personalhub_session");
  assert.equal(sessionCookie.httpOnly, true);
  assert.equal(sessionCookie.secure, true);
  assert.equal(sessionCookie.sameSite, "Strict");
  assert.equal(sessionCookie.path, "/");

  const sidebar = page.locator("aside");
  const brand = page.getByRole("link", { name: "PersonalHub", exact: true });
  const hideSidebar = page.getByRole("button", { name: "Hide sidebar" });
  const themeButton = page.getByRole("button", {
    name: /Switch to (?:dark|light) mode/
  });
  const signOut = page.getByRole("button", { name: "Sign out" });
  const [sidebarBox, brandBox, hideBox, themeBox, signOutBox] =
    await Promise.all(
      [sidebar, brand, hideSidebar, themeButton, signOut].map((locator) =>
        locator.boundingBox()
      )
    );
  assert.ok(sidebarBox && brandBox && hideBox && themeBox && signOutBox);
  assert.ok(brandBox.x + brandBox.width + 8 <= hideBox.x);
  assert.ok(hideBox.x + hideBox.width + 4 <= themeBox.x);
  assert.ok(themeBox.x + themeBox.width + 4 <= signOutBox.x);
  assert.ok(
    signOutBox.x + signOutBox.width <= sidebarBox.x + sidebarBox.width - 8
  );
  assert.ok([hideBox, themeBox, signOutBox].every((box) => box.width >= 36));

  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const [
      resizedSidebarBox,
      resizedBrandBox,
      resizedHideBox,
      resizedSignOutBox
    ] = await Promise.all(
      [sidebar, brand, hideSidebar, signOut].map((locator) =>
        locator.boundingBox()
      )
    );
    assert.ok(
      resizedSidebarBox &&
        resizedBrandBox &&
        resizedHideBox &&
        resizedSignOutBox
    );
    assert.ok(
      resizedBrandBox.x + resizedBrandBox.width + 8 <= resizedHideBox.x
    );
    assert.ok(
      resizedSignOutBox.x + resizedSignOutBox.width <=
        resizedSidebarBox.x + resizedSidebarBox.width - 8
    );
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  await hideSidebar.click();
  const showSidebar = page.getByRole("button", { name: "Show sidebar" });
  await showSidebar.waitFor();
  const [collapsedSidebarBox, showBox] = await Promise.all([
    sidebar.boundingBox(),
    showSidebar.boundingBox()
  ]);
  assert.ok(collapsedSidebarBox && showBox);
  assert.ok(showBox.x >= collapsedSidebarBox.x + 8);
  assert.ok(
    showBox.x + showBox.width <=
      collapsedSidebarBox.x + collapsedSidebarBox.width - 8
  );
  await showSidebar.click();
  await hideSidebar.waitFor();

  captureProtectedActions = true;
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.getByRole("button", { name: "Switch to light mode" }).waitFor();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.getByRole("button", { name: "Switch to dark mode" }).waitFor();
  const quickTitle = page.getByLabel("Task title");
  for (let index = 0; index < 2; index++) {
    await quickTitle.fill(repeatedTask);
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByRole("button", { name: "Add task" }).waitFor();
    await page.waitForFunction(
      () => document.querySelector("input#quick-title")?.value === ""
    );
  }
  await page.getByText("Task added.").waitFor();

  await goto("/tags");
  await page.locator('input[name="name"]').first().fill(tagName);
  await page.locator('input[name="color"]').first().fill("#0f766e");
  await page.getByRole("button", { name: "Add tag" }).click();
  await page.locator(`input[name="name"][value="${tagName}"]`).waitFor();

  await goto("/projects");
  await page.locator('form input[name="title"]').first().fill(projectTitle);
  await page.getByText("Project metadata").click();
  await page
    .locator('form textarea[name="description"]')
    .first()
    .fill("Browser-created project");
  await page
    .locator('form select[name="status"]')
    .first()
    .selectOption("active");
  await page
    .locator('form select[name="priority"]')
    .first()
    .selectOption("high");
  await page
    .locator('form textarea[name="nextAction"]')
    .first()
    .fill("Run browser smoke");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("link", { name: projectTitle }).waitFor();

  await goto("/assignments");
  await page.locator('form input[name="courseCode"]').fill("QA101");
  await page.locator('form input[name="courseName"]').fill("Quality Assurance");
  await page.locator('form input[name="title"]').fill(assignmentTitle);
  await page.getByText("Additional details").click();
  await page.locator('form input[name="deadline"]').fill("2026-12-31");
  await page.locator(`input[name="tagIds"]`).check();
  await page.getByRole("button", { name: "Create assignment" }).click();
  await page.getByRole("link", { name: `QA101: ${assignmentTitle}` }).waitFor();

  await goto("/tasks");
  const taskLink = page.getByRole("link", { name: repeatedTask }).first();
  await Promise.all([
    page.waitForURL(/\/tasks\?edit=[^&]+$/),
    taskLink.click()
  ]);
  await page.getByRole("heading", { name: "Edit task" }).waitFor();
  const taskForm = page.locator('form:has(input[name="id"])').first();
  await taskForm
    .locator('input[name="title"]')
    .fill("Preserve invalid task values");
  await taskForm.locator('input[name="startDate"]').fill("2026-12-31");
  await taskForm.locator('input[name="dueDate"]').fill("2026-01-01");
  await taskForm.getByRole("button", { name: "Save task" }).click();
  await taskForm.getByText("Due date cannot be before start date.").waitFor();
  assert.equal(
    await taskForm.locator('input[name="title"]').inputValue(),
    "Preserve invalid task values"
  );
  assert.equal(
    await taskForm.locator('input[name="startDate"]').inputValue(),
    "2026-12-31"
  );
  assert.equal(
    await taskForm.locator('input[name="dueDate"]').inputValue(),
    "2026-01-01"
  );
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find(
      (candidate) => candidate.textContent?.trim() === "Save task"
    );
    return button instanceof HTMLButtonElement && !button.disabled;
  });
  await taskForm.locator('input[name="startDate"]').fill("");
  await taskForm.locator('input[name="dueDate"]').fill("");
  await taskForm.locator('input[name="title"]').fill(`${repeatedTask} edited`);
  await taskForm
    .locator('select[name="projectId"]')
    .selectOption({ label: projectTitle });
  await taskForm.locator('input[name="tagIds"]').check();
  await taskForm.getByRole("button", { name: "Save task" }).click();
  await page.getByRole("link", { name: `${repeatedTask} edited` }).waitFor();
  await page.waitForLoadState("networkidle");
  await taskForm.locator('input[name="title"]').fill(editedTask);
  await taskForm.getByRole("button", { name: "Save task" }).click();
  await page.getByRole("link", { name: editedTask }).waitFor();
  await page.getByRole("button", { name: "Complete" }).first().click();
  await page
    .locator("span")
    .filter({ hasText: /^done$/ })
    .first()
    .waitFor();

  await goto("/notes");
  await page.locator('form input[name="title"]').first().fill(noteTitle);
  await page
    .locator('form textarea[name="body"]')
    .first()
    .fill("Linked note body");
  await page.getByText("Links and tags").click();
  await page
    .locator('form select[name="linkedTaskId"]')
    .selectOption({ label: editedTask });
  await page
    .locator('form select[name="linkedAssignmentId"]')
    .selectOption({ label: `QA101: ${assignmentTitle}` });
  await page
    .locator('form select[name="projectId"]')
    .selectOption({ label: projectTitle });
  await page.locator('form input[name="tagIds"]').check();
  await page.getByRole("button", { name: "Create note" }).click();
  await page.getByRole("link", { name: noteTitle }).waitFor();

  for (const route of ["/calendar", "/timeline"]) {
    await goto(route);
    assert.equal(
      await page.locator("body").getAttribute("data-scroll-locked"),
      null
    );
    await page.screenshot({
      path: `${artifacts}${route.replace("/", "/")}.png`,
      fullPage: true
    });
  }
  await goto("/tasks?edit=missing-browser-id");
  await page
    .getByRole("heading", { name: "That item no longer exists" })
    .waitFor();

  await goto("/settings");
  await page.getByLabel("Token name").fill(apiTokenName);
  await page.getByLabel("Write").check();
  await page.getByRole("button", { name: "Create token" }).click();
  const plaintext = await page.getByTestId("new-api-token").textContent();
  assert.match(plaintext ?? "", /^phv1\./);
  apiAuthorization = `Bearer ${plaintext}`;
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.equal(await page.getByTestId("new-api-token").count(), 0);

  const invalid = await json("/api/v1/capture", {
    method: "POST",
    data: { title: "" }
  });
  assert.equal(invalid.response.status(), 422);
  assert.equal(invalid.body.error.code, "VALIDATION_ERROR");
  const missing = await json("/api/v1/tasks/missing-browser-id");
  assert.equal(missing.response.status(), 404);
  const captured = await json("/api/v1/capture", {
    method: "POST",
    data: { title: `API ${unique}`, dueDate: "2026-12-30" }
  });
  assert.equal(captured.response.status(), 201);
  const id = captured.body.data.id;
  const patched = await json(`/api/v1/tasks/${id}`, {
    method: "PATCH",
    data: { priority: "urgent" }
  });
  assert.equal(patched.body.data.priority, "urgent");
  const completed = await json(`/api/v1/tasks/${id}/complete`, {
    method: "POST"
  });
  assert.equal(completed.body.data.status, "done");
  for (const endpoint of [
    "/api/v1/today",
    "/api/v1/upcoming",
    "/api/v1/tasks"
  ]) {
    const result = await json(endpoint);
    assert.equal(result.response.ok(), true);
    assert.ok("data" in result.body);
  }

  await goto("/");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.getByRole("button", { name: "Switch to light mode" }).waitFor();
  await page.screenshot({
    path: `${artifacts}/dashboard-dark.png`,
    fullPage: true
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await goto("/");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  assert.ok(overflow <= 1, `mobile layout overflows by ${overflow}px`);
  await page.screenshot({
    path: `${artifacts}/dashboard-mobile.png`,
    fullPage: true
  });

  await goto("/tags");
  const tagEditor = page
    .locator("form")
    .filter({ has: page.locator(`input[name="name"][value="${tagName}"]`) });
  const tagCard = tagEditor.locator("..");
  await tagCard.getByRole("button", { name: "Delete" }).click();
  await tagCard.getByRole("button", { name: "Confirm delete" }).click();
  await page
    .locator(`input[name="name"][value="${tagName}"]`)
    .waitFor({ state: "detached" });
  await goto("/tasks");
  await page.getByRole("link", { name: editedTask }).waitFor();
  await goto("/assignments");
  await page.getByRole("link", { name: `QA101: ${assignmentTitle}` }).waitFor();
  await goto("/notes");
  await page.getByRole("link", { name: noteTitle }).waitFor();

  await goto("/tasks");
  const disposableCard = page
    .getByRole("link", { name: repeatedTask, exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");
  await disposableCard.getByRole("button", { name: "Delete" }).click();
  await disposableCard.getByRole("button", { name: "Confirm delete" }).click();
  await page
    .getByRole("link", { name: repeatedTask, exact: true })
    .waitFor({ state: "detached" });

  assert.ok(
    capturedServerAction,
    "Expected to capture a real Server Action request."
  );
  const beforeReplay = await json("/api/v1/tasks");
  const beforeCount = beforeReplay.body.data.length;
  const replayHeaders = {
    "content-type": capturedServerAction.contentType,
    "next-action": capturedServerAction.actionId
  };
  const crossOrigin = await context.request.fetch("/", {
    method: "POST",
    headers: { ...replayHeaders, origin: "https://evil.example" },
    data: capturedServerAction.body
  });
  assert.equal(crossOrigin.ok(), false);
  await context.clearCookies();
  const anonymousAction = await context.request.fetch("/", {
    method: "POST",
    headers: { ...replayHeaders, origin: baseURL },
    data: capturedServerAction.body
  });
  assert.equal(anonymousAction.ok(), false);
  const afterReplay = await json("/api/v1/tasks");
  assert.equal(afterReplay.body.data.length, beforeCount);

  await goto("/settings");
  await page.waitForURL(/\/login$/);
  await page.getByLabel("Owner password").fill(ownerPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${baseURL}/`);
  await goto("/settings");
  const tokenCard = page
    .locator("div.rounded-md.border")
    .filter({ hasText: apiTokenName });
  await tokenCard.getByRole("button", { name: "Revoke" }).click();
  await tokenCard.getByText(/^Revoked /).waitFor();
  const revoked = await json("/api/v1/today");
  assert.equal(revoked.response.status(), 401);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login$/);
  await goto("/tasks");
  await page.waitForURL(/\/login$/);

  assert.deepEqual(errors, []);
} catch (error) {
  console.error("Browser request trace:", requests.join("\n"));
  console.error("Browser errors:", errors.join("\n"));
  await page
    .screenshot({ path: `${artifacts}/failure.png`, fullPage: true })
    .catch(() => undefined);
  throw error;
} finally {
  await context.close();
  await browser.close();
}
