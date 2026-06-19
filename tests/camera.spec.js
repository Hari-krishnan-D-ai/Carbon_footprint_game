import { test, expect } from '@playwright/test';
import { getThreeJsState } from './helpers.js';

test.describe('Feature 1: Town Hall Camera & Controls', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    // Complete onboarding so dialogue overlay does not interfere
    const btn = page.locator('.cc-sarah__action-btn');
    if (await btn.isVisible()) {
      await btn.click();
    }
  });

  // ===== TIER 1: Feature Coverage (5 tests) =====

  test('TC-F1-01: should have correct camera focus target at center of Town Hall model', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasControls).toBe(true);
    expect(state.controls.target).not.toBeNull();
    
    const [x, y, z] = state.controls.target;
    expect(x).toBeCloseTo(0, 1);
    expect(y).toBeCloseTo(1.0, 1);
    expect(z).toBeCloseTo(0, 1);
  });

  test('TC-F1-02: should enforce minPolarAngle to prevent going too high or below ground', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasControls).toBe(true);
    expect(state.controls.minPolarAngle).toBeCloseTo(0.1, 4);
  });

  test('TC-F1-03: should enforce maxPolarAngle to prevent going below ground level', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasControls).toBe(true);
    expect(state.controls.maxPolarAngle).toBeCloseTo(Math.PI / 2.05, 4);
  });

  test('TC-F1-04: should enforce minDistance zoom limit to prevent clipping into Town Hall', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasControls).toBe(true);
    expect(state.controls.minDistance).toBe(5);
  });

  test('TC-F1-05: should enforce maxDistance zoom limit to keep focus on the village scene', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasControls).toBe(true);
    expect(state.controls.maxDistance).toBe(25);
  });

  // ===== TIER 2: Boundary & Corner Cases (5 tests) =====

  test('TC-F1-06: should not scale camera position on standard wide landscape aspect ratio', async ({ page }) => {
    // 1280x720 aspect ratio is 1.777 (> 1.6 target aspect ratio)
    await page.setViewportSize({ width: 1280, height: 720 });
    // Let layout trigger
    await page.waitForTimeout(500);

    const state = await getThreeJsState(page);
    expect(state.hasCamera).toBe(true);
    
    // Base position is [6, 4.5, 8]
    const [x, y, z] = state.camera.position;
    expect(x).toBeCloseTo(6, 1);
    expect(y).toBeCloseTo(4.5, 1);
    expect(z).toBeCloseTo(8, 1);
  });

  test('TC-F1-07: should scale camera position outwards on narrow portrait viewports (e.g. mobile)', async ({ page }) => {
    // 400x800 aspect ratio is 0.5 (< 1.6 target aspect ratio)
    await page.setViewportSize({ width: 400, height: 800 });
    await page.waitForTimeout(500);

    const state = await getThreeJsState(page);
    expect(state.hasCamera).toBe(true);
    
    const [x, y, z] = state.camera.position;
    // Multiplier = targetAspect / aspect = 1.6 / 0.5 = 3.2, clamped to 2.2
    // So final position should be basePos * 2.2 = [13.2, 9.9, 17.6]
    expect(x).toBeCloseTo(6 * 2.2, 1);
    expect(y).toBeCloseTo(4.5 * 2.2, 1);
    expect(z).toBeCloseTo(8 * 2.2, 1);
  });

  test('TC-F1-08: should clamp max zoom-out multiplier to 2.2 for extremely narrow viewports', async ({ page }) => {
    // 200x1000 aspect ratio is 0.2 (< 1.6)
    await page.setViewportSize({ width: 200, height: 1000 });
    await page.waitForTimeout(500);

    const state = await getThreeJsState(page);
    expect(state.hasCamera).toBe(true);
    
    const [x, y, z] = state.camera.position;
    // Multiplier = 1.6 / 0.2 = 8.0, clamped to 2.2
    expect(x).toBeCloseTo(6 * 2.2, 1);
    expect(y).toBeCloseTo(4.5 * 2.2, 1);
    expect(z).toBeCloseTo(8 * 2.2, 1);
  });

  test('TC-F1-09: should disable panning and enable zooming in OrbitControls configuration', async ({ page }) => {
    const state = await getThreeJsState(page);
    expect(state.hasControls).toBe(true);
    expect(state.controls.enablePan).toBe(false);
    expect(state.controls.enableZoom).toBe(true);
  });

  test('TC-F1-10: should lock the lookAt target to center of Town Hall after simulating a drag action', async ({ page }) => {
    // Simulate a mouse drag on the canvas to rotate
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50);
      await page.mouse.up();
    }
    await page.waitForTimeout(300);

    const state = await getThreeJsState(page);
    expect(state.controls.target ? [state.controls.target[0], state.controls.target[1], state.controls.target[2]] : null).not.toBeNull();
    const [x, y, z] = state.controls.target;
    // Target should remain locked to [0, 1.0, 0] despite drag action
    expect(x).toBeCloseTo(0, 1);
    expect(y).toBeCloseTo(1.0, 1);
    expect(z).toBeCloseTo(0, 1);
  });

  test('TC-F1-11: should handle extremely wide landscape viewports without zooming in past 1.0', async ({ page }) => {
    // aspect ratio 10.0 (> 1.6)
    await page.setViewportSize({ width: 2000, height: 200 });
    await page.waitForTimeout(500);

    const state = await getThreeJsState(page);
    expect(state.hasCamera).toBe(true);
    
    const [x, y, z] = state.camera.position;
    // Multiplier = 1.0, position should be exactly [6, 4.5, 8]
    expect(x).toBeCloseTo(6, 1);
    expect(y).toBeCloseTo(4.5, 1);
    expect(z).toBeCloseTo(8, 1);
  });

  test('TC-F1-12: should prevent camera from jumping during window resize operations', async ({ page }) => {
    // 1. Start landscape
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(300);
    let state = await getThreeJsState(page);
    expect(state.camera.position[0]).toBeCloseTo(6, 1);

    // 2. Resize to portrait
    await page.setViewportSize({ width: 400, height: 800 });
    await page.waitForTimeout(300);
    state = await getThreeJsState(page);
    expect(state.camera.position[0]).toBeCloseTo(6 * 2.2, 1);

    // 3. Resize back to landscape
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(300);
    state = await getThreeJsState(page);
    expect(state.camera.position[0]).toBeCloseTo(6, 1);
    
    // Target must still be center of Town Hall
    const [tx, ty, tz] = state.controls.target;
    expect(tx).toBeCloseTo(0, 1);
    expect(ty).toBeCloseTo(1.0, 1);
    expect(tz).toBeCloseTo(0, 1);
  });

  test('TC-F1-13: should enforce maxPolarAngle and minPolarAngle at runtime after drag interaction', async ({ page }) => {
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      // Drag upwards dramatically (rotate around x-axis, trying to view from top)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 300);
      await page.mouse.up();
      await page.waitForTimeout(200);

      let state = await getThreeJsState(page);
      let [cx, cy, cz] = state.camera.position;
      let [tx, ty, tz] = state.controls.target;
      let dx = cx - tx;
      let dy = cy - ty;
      let dz = cz - tz;
      let distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      let polarAngle = Math.acos(dy / distance);
      // Should be clamped by minPolarAngle = 0.1
      expect(polarAngle).toBeGreaterThanOrEqual(0.09); // allowing floating point tolerance

      // Drag downwards dramatically (try to go below ground level)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 300);
      await page.mouse.up();
      await page.waitForTimeout(200);

      state = await getThreeJsState(page);
      [cx, cy, cz] = state.camera.position;
      [tx, ty, tz] = state.controls.target;
      dx = cx - tx;
      dy = cy - ty;
      dz = cz - tz;
      distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      polarAngle = Math.acos(dy / distance);
      // Should be clamped by maxPolarAngle = Math.PI / 2.05
      expect(polarAngle).toBeLessThanOrEqual(Math.PI / 2.05 + 0.05);
    }
  });
});
