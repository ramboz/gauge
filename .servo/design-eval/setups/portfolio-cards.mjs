// Deterministic-enough app state for the portfolio-cards fidelity screen.
//
// capture.mjs has already navigated to config.app_url. The Gauge dashboard
// collects observations LIVE on load ("collecting current observations…"),
// so the only seeding needed is to wait until the project cards have actually
// rendered before the screenshot — otherwise we'd capture the loading
// placeholder. The fidelity rubric ignores dynamic content (project names,
// numbers), so the live portfolio data does not need pinning for a design
// judgment; it only needs to be past its loading state and painted.
export default async function (page /*, config */) {
  // Wait for at least one project card to exist (the grid has rendered).
  await page.waitForSelector('.grid article.card, .grid .card', { timeout: 25000 });
  // Let sparklines / trend rows and web-font metrics settle before the shot.
  await page.waitForTimeout(1800);
}
