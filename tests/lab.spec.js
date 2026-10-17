import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function apply(page, value) {
  await page.locator("#color-input").fill(value);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
}
test("experiment index links to a working color editor", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.getByRole("link", { name: /Color lab/ }).click();
  await expect(
    page.getByRole("heading", { name: "Color lab.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".palette-swatch")).toHaveCount(9);
  expect(errors).toEqual([]);
});
test("OKLab and OKLCH stay synchronized; import, validation and gamut mapping work", async ({
  page,
}) => {
  await page.goto("./oklch-explorer/");
  await apply(page, "#ff0000");
  await expect(page.locator("#preview-hex")).toHaveText("#ff0000");
  await page.getByRole("button", { name: "OKLab", exact: true }).click();
  await expect(page.locator("#value-a")).toHaveValue("0.225");
  await expect(page.locator("#value-b")).toHaveValue("0.126");
  await expect(page.locator("#preview-hex")).toHaveText("#ff0000");
  await page.getByRole("button", { name: "OKLCH", exact: true }).click();
  await apply(page, "color(display-p3 1 0 0)");
  await expect(page.locator("#gamut-status")).toHaveText("Display P3 only");
  await page.getByRole("button", { name: "Map to sRGB", exact: true }).click();
  await expect(page.locator("#gamut-status")).toHaveText("In sRGB");
  await apply(page, "oklch(60% .5 30)");
  await expect(page.locator("#gamut-status")).toHaveText("Outside both");
  await apply(page, "not a color");
  await expect(page.locator("#input-error")).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("#input-error")).not.toBeVisible();
});
test("contrast handles alpha; palette exports and URL state restore", async ({
  page,
}) => {
  await page.goto("./oklch-explorer/");
  await apply(page, "black");
  await expect(page.locator("#contrast-light-ratio")).toHaveText("21.00:1");
  await page.locator("#alpha-value").fill("50");
  await expect(page.locator("#contrast-light-ratio")).toHaveText("3.98:1");
  await page.getByRole("button", { name: "Copy link", exact: true }).click();
  await page.reload();
  await expect(page.locator("#alpha-value")).toHaveValue("50");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export JSON/ }).click();
  expect((await download).suggestedFilename()).toBe("color-lab-palette.json");
  await page.getByRole("button", { name: /Copy CSS/ }).click();
  await expect(page.getByRole("status")).toContainText(
    /Copied|Clipboard unavailable/,
  );
  await expect(page.locator(".gradient-row")).toHaveCount(3);
  await page.locator("#gradient-a").fill("oops");
  await expect(page.locator("#gradient-error")).toBeVisible();
});
test("responsive layout and accessible controls in both system themes", async ({
  page,
}, info) => {
  await page.goto("./oklch-explorer/");
  await expect(page.locator(".palette-swatch")).toHaveCount(9);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.screenshot({
    path: `test-results/color-lab-${info.project.name}.png`,
    fullPage: true,
  });
});

test("numeric controls allow decimal typing and represent high-chroma colors in OKLab", async ({
  page,
}) => {
  await page.goto("./oklch-explorer/");
  await page.locator("#value-c").fill("");
  await page.locator("#value-c").pressSequentially("0.123");
  await expect(page.locator("#value-c")).toHaveValue("0.123");
  await apply(page, "oklch(60% .5 0)");
  await page.getByRole("button", { name: "OKLab", exact: true }).click();
  await expect(page.locator("#value-a")).toHaveValue("0.5");
  await page.locator("#value-a").fill("0.45");
  await page.getByRole("button", { name: "OKLCH", exact: true }).click();
  await expect(page.locator("#value-c")).toHaveValue("0.45");
});
