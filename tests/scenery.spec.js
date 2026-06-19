import { test, expect } from '@playwright/test';
import { getThreeJsState } from './helpers.js';

test.describe('Feature 2: Immersive Scenery & Fog Dynamics', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Dismiss onboarding so it's clean
    const btn = page.locator('.cc-sarah__action-btn');
    if (await btn.isVisible()) {
      await btn.click();
    }
  });

  // ===== TIER 1: Feature Coverage (5 tests) =====

  test('TC-F2-01: ground geometry radius should be expanded to 200', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasScene).toBe(true);
    expect(state.scene.ground.radius).toBe(200);
  });

  test('TC-F2-02: ground geometry radial segments should be 64', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasScene).toBe(true);
    expect(state.scene.ground.radialSegments).toBe(64);
  });

  test('TC-F2-03: default fog near parameter should be 10', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasScene).toBe(true);
    expect(state.scene.hasFog).toBe(true);
    // On load, near starts at 10
    expect(state.scene.fog.near).toBeCloseTo(10, 1);
  });

  test('TC-F2-04: default fog far parameter should be 30', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasScene).toBe(true);
    expect(state.scene.hasFog).toBe(true);
    // On load, far starts at 30
    expect(state.scene.fog.far).toBeCloseTo(30, 1);
  });

  test('TC-F2-05: default fog color should match clear sky color (#87ceeb)', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasScene).toBe(true);
    expect(state.scene.hasFog).toBe(true);
    expect(state.scene.fog.color).toBe('87ceeb');
  });

  // ===== TIER 2: Boundary & Corner Cases (5 tests) =====

  test('TC-F2-06: background sky color should match fog color at all times to eliminate horizon seam', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasScene).toBe(true);
    expect(state.scene.hasFog).toBe(true);
    expect(state.scene.background).toBe(state.scene.fog.color);
  });

  test('TC-F2-07: fog limits should converge towards near=10 and far=30 at 0% pollution', async ({ page }) => {
    // Set pollutionFactor to 0 via Zustand store
    await page.evaluate(() => {
      window.useGameStore.setState({ pollutionFactor: 0 });
    });
    // Wait for dampening convergence
    await page.waitForTimeout(2000);

    const state = await getThreeJsState(page);
    // targetNear = 10 - 0 * 5 = 10
    // targetFar = 30 - 0 * 14 = 30
    expect(state.scene.fog.near).toBeCloseTo(10.0, 1);
    expect(state.scene.fog.far).toBeCloseTo(30.0, 1);
  });

  test('TC-F2-08: fog limits should converge towards near=7.5 and far=23 at 50% pollution', async ({ page }) => {
    // Set pollutionFactor to 50 via Zustand store
    await page.evaluate(() => {
      window.useGameStore.setState({ pollutionFactor: 50 });
    });
    // Wait for dampening convergence
    await page.waitForTimeout(2000);

    const state = await getThreeJsState(page);
    // targetNear = 10 - 0.5 * 5 = 7.5
    // targetFar = 30 - 0.5 * 14 = 23.0
    expect(state.scene.fog.near).toBeCloseTo(7.5, 1);
    expect(state.scene.fog.far).toBeCloseTo(23.0, 1);
  });

  test('TC-F2-09: fog limits should converge towards near=5 and far=16 at 100% pollution', async ({ page }) => {
    // Set pollutionFactor to 100 via Zustand store
    await page.evaluate(() => {
      window.useGameStore.setState({ pollutionFactor: 100 });
    });
    // Wait for dampening convergence
    await page.waitForTimeout(2000);

    const state = await getThreeJsState(page);
    // targetNear = 10 - 1.0 * 5 = 5.0
    // targetFar = 30 - 1.0 * 14 = 16.0
    expect(state.scene.fog.near).toBeCloseTo(5.0, 1);
    expect(state.scene.fog.far).toBeCloseTo(16.0, 1);
  });

  test('TC-F2-10: critical damage (isEvilFlashing = true) should shift fog limits to near=3 and far=8, and fog color to dark red (#3a0505)', async ({ page }) => {
    // Set isEvilFlashing to true via Zustand store
    await page.evaluate(() => {
      window.useGameStore.setState({ isEvilFlashing: true });
    });
    // Wait for rapid convergence (it has a higher damp rate: 10 vs 2)
    await page.waitForTimeout(1000);

    const state = await getThreeJsState(page);
    expect(state.scene.fog.near).toBeCloseTo(3.0, 1);
    expect(state.scene.fog.far).toBeCloseTo(8.0, 1);
    // Hex string for #3a0505 is 3a0505
    expect(state.scene.fog.color).toBe('3a0505');
  });
});
