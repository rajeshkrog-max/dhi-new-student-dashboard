// A signed in student with a finished interview, for the browser scripts that need the dashboard (spec house/0003, AC-13). It signs in with the
// test form and reuses one fixed test account, so it does not leave a new account behind on every run. Development backend only: callers run
// assertLocalDevelopment first. Returns the browser storage state (the session cookie) to seed more browser contexts.
export const TEST_STUDENT = { email: "look-sweep@example.com", password: "look-sweep-pass-1", name: "Sweep Student", cls: "College" };

async function waitForPath(page, prefix, ms = 30_000) {
  await page.waitForURL((url) => url.pathname.startsWith(prefix), { timeout: ms });
}

export async function signInFinishedStudent(browser, base) {
  const context = await browser.newContext({ baseURL: base.origin });
  const page = await context.newPage();
  await page.goto("/enter");
  await page.getByTestId("landing-email").fill(TEST_STUDENT.email);
  await page.getByTestId("landing-password").fill(TEST_STUDENT.password);
  await page.getByTestId("landing-submit").click();
  await page.waitForURL((url) => url.pathname.startsWith("/dhiinterviews/") || url.pathname.startsWith("/dashboard"), { timeout: 30_000 });

  // A new account goes to the interview. Finish it the way a student would, through the funnel's own session helpers.
  if (new URL(page.url()).pathname.startsWith("/dhiinterviews/")) {
    await page.waitForFunction(() => window.DhiSession, null, { timeout: 20_000 });
    const made = await page.evaluate(
      (profile) => window.DhiSession.createProfile(profile),
      { name: TEST_STUDENT.name, age: 20, class: TEST_STUDENT.cls, guardianPresent: false },
    );
    if (made?.ok !== true) throw new Error(`createProfile answered ${JSON.stringify(made)}`);
    await page.goto("/dhiinterviews/question.html");
    await page.waitForFunction(() => window.DhiStore && window.DhiSession, null, { timeout: 20_000 });
    await page.evaluate(() => {
      for (let n = 1; n <= 18; n += 1) window.DhiStore.answer(n, `q${n}o2`);
    });
    await page.waitForFunction(() => window.DhiSession.pendingCount() === 0, null, { timeout: 30_000 });
    const finished = await page.evaluate(() => window.DhiSession.finish());
    if (finished?.ok !== true) throw new Error(`finish answered ${JSON.stringify(finished)}`);
    await page.goto("/enter");
    await waitForPath(page, "/dashboard");
  }

  await page.getByRole("heading", { name: TEST_STUDENT.name }).first().waitFor({ timeout: 20_000 });
  const state = await context.storageState();
  await context.close();
  return state;
}
