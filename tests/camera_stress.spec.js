import { test, expect } from '@playwright/test';
import { getThreeJsState } from './helpers.js';

test.describe('Camera & OrbitControls Stress Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    // Complete onboarding so dialogue overlay does not interfere
    const btn = page.locator('.cc-sarah__action-btn');
    if (await btn.isVisible()) {
      await btn.click();
    }
  });

  // Test extremely wide viewport (e.g. multi-monitor or ultra-wide screen)
  test('TC-ST-01: should not scale camera position on extremely wide viewports', async ({ page }) => {
    // 2560x500 aspect ratio is 5.12 (> 1.6)
    await page.setViewportSize({ width: 2560, height: 500 });
    await page.waitForTimeout(500);

    const state = await getThreeJsState(page);
    expect(state.hasCamera).toBe(true);

    const [x, y, z] = state.camera.position;
    // Multiplier should be 1.0 (no scaling for aspect ratios larger than 1.6)
    expect(x).toBeCloseTo(6.0, 1);
    expect(y).toBeCloseTo(4.5, 1);
    expect(z).toBeCloseTo(8.0, 1);
  });

  // Test square viewport (e.g. split screens)
  test('TC-ST-02: should scale camera position correctly on a square viewport', async ({ page }) => {
    // 800x800 aspect ratio is 1.0 (< 1.6)
    await page.setViewportSize({ width: 800, height: 800 });
    await page.waitForTimeout(500);

    const state = await getThreeJsState(page);
    expect(state.hasCamera).toBe(true);

    const [x, y, z] = state.camera.position;
    // Multiplier = targetAspect / aspect = 1.6 / 1.0 = 1.6
    expect(x).toBeCloseTo(6 * 1.6, 1);
    expect(y).toBeCloseTo(4.5 * 1.6, 1);
    expect(z).toBeCloseTo(8 * 1.6, 1);
  });

  // Test dynamic resizing: transition from wide to narrow and back
  test('TC-ST-03: should scale camera dynamically on viewport resize without breaking limits', async ({ page }) => {
    // Start wide
    await page.setViewportSize({ width: 1200, height: 600 }); // aspect 2.0
    await page.waitForTimeout(300);
    let state = await getThreeJsState(page);
    expect(state.camera.position[0]).toBeCloseTo(6.0, 1);

    // Resize to narrow portrait
    await page.setViewportSize({ width: 400, height: 800 }); // aspect 0.5
    await page.waitForTimeout(300);
    state = await getThreeJsState(page);
    // Multiplier clamped to 2.2
    expect(state.camera.position[0]).toBeCloseTo(6 * 2.2, 1);

    // Resize back to wide
    await page.setViewportSize({ width: 1200, height: 600 });
    await page.waitForTimeout(300);
    state = await getThreeJsState(page);
    expect(state.camera.position[0]).toBeCloseTo(6.0, 1);
  });

  // Test interactions and camera jumps during resize
  test('TC-ST-04: camera resize resets user rotation/zoom, behaving predictably', async ({ page }) => {
    // 1. Zoom in/out or rotate using OrbitControls
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (box) {
      // Drag mouse to rotate
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 + 100);
      await page.mouse.up();
    }
    await page.waitForTimeout(300);

    const postDragState = await getThreeJsState(page);
    const dragPos = postDragState.camera.position;

    // 2. Trigger resize
    await page.setViewportSize({ width: 500, height: 1000 }); // aspect 0.5
    await page.waitForTimeout(300);

    const postResizeState = await getThreeJsState(page);
    // Verify it resets camera position to the exact responsive base position [13.2, 9.9, 17.6]
    // instead of keeping the rotated position, which is the current implementation behavior.
    expect(postResizeState.camera.position[0]).toBeCloseTo(6 * 2.2, 1);
    expect(postResizeState.camera.position[1]).toBeCloseTo(4.5 * 2.2, 1);
    expect(postResizeState.camera.position[2]).toBeCloseTo(8 * 2.2, 1);
  });

  // Verify damping in OrbitControls
  test('TC-ST-05: should have damping enabled in OrbitControls', async ({ page }) => {
    const state = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas && canvas.__r3f && canvas.__r3f.store) {
        const controls = canvas.__r3f.store.getState().controls;
        return {
          enableDamping: controls ? controls.enableDamping : null,
          dampingFactor: controls ? controls.dampingFactor : null,
        };
      }
      return null;
    });

    expect(state).not.toBeNull();
    // In Drei OrbitControls, enableDamping defaults to true unless explicitly disabled.
    // Let's verify that this default or set value is indeed true.
    expect(state.enableDamping).toBe(true);
  });
});
