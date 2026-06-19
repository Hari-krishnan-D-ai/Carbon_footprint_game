import { test, expect } from '@playwright/test';
import { getThreeJsState, mockAnalyzeIntent } from './helpers.js';

test.describe('Tier 3: Cross-Feature Integration Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC-CF-01: should adjust camera zoom and NPC dialogue layouts concurrently on mobile screen widths', async ({ page }) => {
    // 1. Check layout and camera on narrow mobile viewport
    await page.setViewportSize({ width: 500, height: 800 });
    await page.waitForTimeout(500);

    // Camera aspect ratio scale factor check (Feature 1)
    const state = await getThreeJsState(page);
    expect(state.hasCamera).toBe(true);
    const [x, y, z] = state.camera.position;
    // Mobile view aspect ratio is 500/800 = 0.625. Multiplier = 1.6 / 0.625 = 2.56, clamped to 2.2
    expect(x).toBeCloseTo(6 * 2.2, 1);

    // NPC Dialogue layout check (Feature 3 responsive styles)
    const bubbleArrow = page.locator('.cc-sarah__bubble-arrow');
    // On mobile (< 600px), .cc-sarah__bubble-arrow has display: none
    const arrowDisplay = await bubbleArrow.evaluate(el => window.getComputedStyle(el).display);
    expect(arrowDisplay).toBe('none');
  });

  test('TC-CF-02: should contract fog and update NPC mood to worried on environmental damage action', async ({ page }) => {
    await page.locator('.cc-sarah__action-btn').click();

    // Mock negative intent
    await mockAnalyzeIntent(page, {
      impactScore: -12,
      category: 'travel',
      remedy: 'The CO2 ghost is coming for you! Drive less!'
    });

    const input = page.locator('#action-input');
    await input.fill('I drove a gas-guzzling SUV');
    await page.locator('#submit-action').click();

    // 1. NPC mood should update to worried
    const avatar = page.locator('.cc-sarah__avatar');
    await expect(avatar).toHaveClass(/cc-sarah__avatar--worried/);

    // 2. Barbarian Alert should display warning
    const alertPanel = page.locator('.cc-barbarian__panel');
    await expect(alertPanel).toBeVisible();

    // 3. Fog limits should contract (pollution factor is updated, reducing visibility)
    // base pollution is 25. An impact of -12 adds 12 to pollution, making it 37.
    // targetNear = 10 - 0.37 * 5 = 8.15
    // targetFar = 30 - 0.37 * 14 = 24.82
    await page.waitForTimeout(2000);
    const threeState = await getThreeJsState(page);
    expect(threeState.scene.fog.near).toBeLessThan(9.5);
    expect(threeState.scene.fog.far).toBeLessThan(28.5);
  });

  test('TC-CF-03: should plant a new tree model and transition NPC mood to celebrating when planting action is reported', async ({ page }) => {
    await page.locator('.cc-sarah__action-btn').click();

    // Mock tree planting intent
    await mockAnalyzeIntent(page, {
      impactScore: 10,
      category: 'general',
      remedy: 'Fabulous! Trees clear the smog.'
    });

    const input = page.locator('#action-input');
    await input.fill('I planted a tree in the park');
    await page.locator('#submit-action').click();

    // 1. Sarah goes into celebrating mode
    const avatar = page.locator('.cc-sarah__avatar');
    await expect(avatar).toHaveClass(/cc-sarah__avatar--celebrating/);

    // 2. Zustand store updates trees count
    const treesCount = await page.evaluate(() => window.useGameStore.getState().plantedTreesCount);
    expect(treesCount).toBe(1);

    // 3. Pollution factor should be lowered (base 25, minus 10 impact score, and special tree planting bonus -30 = clamped to 0)
    const pollution = await page.evaluate(() => window.useGameStore.getState().pollutionFactor);
    expect(pollution).toBe(0);
  });

  test('TC-CF-04: should lock camera target to center of Town Hall during critical threat flash events', async ({ page }) => {
    await page.locator('.cc-sarah__action-btn').click();

    // Mock heavy damage action
    await mockAnalyzeIntent(page, {
      impactScore: -25,
      category: 'travel',
      remedy: 'The CO2 ghost is coming for you! Stop burning coal!'
    });

    const input = page.locator('#action-input');
    await input.fill('I burnt coal in my garden');
    await page.locator('#submit-action').click();

    // Immediately check if the flash state is active
    const isEvilFlashing = await page.evaluate(() => window.useGameStore.getState().isEvilFlashing);
    expect(isEvilFlashing).toBe(true);

    // Verify controls target is still locked at center of Town Hall [0, 1.0, 0]
    const state = await getThreeJsState(page);
    expect(state.hasControls).toBe(true);
    const [x, y, z] = state.controls.target;
    expect(x).toBeCloseTo(0, 1);
    expect(y).toBeCloseTo(1.0, 1);
    expect(z).toBeCloseTo(0, 1);
  });
});
