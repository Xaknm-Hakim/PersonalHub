import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const baseURL = process.env.PERSONALHUB_BROWSER_URL;
if (!baseURL || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL))
  throw new Error("PERSONALHUB_BROWSER_URL must be an explicit loopback URL.");
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

async function json(path, init) {
  const response = await context.request.fetch(path, init);
  const body = await response.json();
  return { response, body };
}

async function goto(path) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

try {
  await goto("/");
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
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
