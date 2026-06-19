import { test, expect } from '@playwright/test';
import { mockAnalyzeIntent } from './helpers.js';

test.describe('Feature 3: Sarah NPC & Dialogue Interactivity', () => {

  // ===== TIER 1: Feature Coverage (5 tests) =====

  test('TC-F3-01: should render the Sarah avatar SVG on the screen', async ({ page }) => {
    await page.goto('/');
    const avatar = page.locator('.cc-sarah__avatar');
    await expect(avatar).toBeVisible();
  });

  test('TC-F3-02: should render the correct name tag "Sarah"', async ({ page }) => {
    await page.goto('/');
    const nameTag = page.locator('.cc-sarah__name-tag');
    await expect(nameTag).toHaveText('Sarah');
  });

  test('TC-F3-03: should apply drop-shadow glow filter styling to the avatar', async ({ page }) => {
    await page.goto('/');
    const avatar = page.locator('.cc-sarah__avatar');
    // Read the filter style property to verify the drop-shadow is defined
    const filterStyle = await avatar.evaluate(el => window.getComputedStyle(el).filter);
    expect(filterStyle).toContain('drop-shadow');
  });

  test('TC-F3-04: should dismiss onboarding message and update HasOnboarded state on action button click', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('.cc-sarah__action-btn');
    await expect(btn).toBeVisible();
    await btn.click();
    
    // Once clicked, onboarding button should disappear
    await expect(btn).not.toBeVisible();
    
    // Check state hasOnboarded is true via Zustand
    const hasOnboarded = await page.evaluate(() => window.useGameStore.getState().hasOnboarded);
    expect(hasOnboarded).toBe(true);
  });

  test('TC-F3-05: should transition mood to celebrating and show sparkles when positive action >= 10 is submitted', async ({ page }) => {
    await page.goto('/');
    // Dismiss onboarding
    await page.locator('.cc-sarah__action-btn').click();
    
    // Mock a positive action with score >= 10
    await mockAnalyzeIntent(page, {
      impactScore: 15,
      category: 'travel',
      remedy: 'Awesome! Keep riding the bicycle!'
    });

    const input = page.locator('#action-input');
    await input.fill('I rode my bicycle to work');
    await page.locator('#submit-action').click();

    // Check avatar has celebrating class
    const avatar = page.locator('.cc-sarah__avatar');
    await expect(avatar).toHaveClass(/cc-sarah__avatar--celebrating/);

    // Sparkles should be present in SVG
    const sparkles = page.locator('.cc-sarah__sparkle');
    await expect(sparkles.first()).toBeAttached();
  });

  // ===== TIER 2: Boundary & Corner Cases (5 tests) =====

  test('TC-F3-06: should hide speech bubble text initially and reveal it after exactly 1.0s (1000ms) delay', async ({ page }) => {
    // Install mock clock before loading the page
    await page.clock.install();
    await page.goto('/');

    const text = page.locator('.cc-sarah__text');
    // At start (0ms), speech bubble text should NOT have the visible class
    await expect(text).not.toHaveClass(/cc-sarah__text--visible/);

    // Fast forward 500ms - should still be hidden according to 1s spec
    await page.clock.fastForward(500);
    await expect(text).not.toHaveClass(/cc-sarah__text--visible/);

    // Fast forward to 1000ms
    await page.clock.fastForward(500);
    await expect(text).toHaveClass(/cc-sarah__text--visible/);
  });

  test('TC-F3-07: should enforce max-width on dialogue bubble to wrap long text properly', async ({ page }) => {
    await page.goto('/');
    const bubble = page.locator('.cc-sarah__bubble');
    
    // On desktop, the bubble max-width is 320px
    const maxWidth = await bubble.evaluate(el => window.getComputedStyle(el).maxWidth);
    expect(maxWidth).toBe('320px');
  });

  test('TC-F3-08: should transition mood to worried when negative action is submitted', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cc-sarah__action-btn').click();

    await mockAnalyzeIntent(page, {
      impactScore: -15,
      category: 'travel',
      remedy: 'The CO2 ghost is coming for you! Ride a bicycle.'
    });

    const input = page.locator('#action-input');
    await input.fill('I left my petrol engine idling');
    await page.locator('#submit-action').click();

    // Check avatar has worried class
    const avatar = page.locator('.cc-sarah__avatar');
    await expect(avatar).toHaveClass(/cc-sarah__avatar--worried/);
  });

  test('TC-F3-09: should transition mood to happy when mild positive action is submitted', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cc-sarah__action-btn').click();

    await mockAnalyzeIntent(page, {
      impactScore: 5,
      category: 'diet',
      remedy: 'Good job eating plant-based!'
    });

    const input = page.locator('#action-input');
    await input.fill('I ate a salad for lunch');
    await page.locator('#submit-action').click();

    // Check avatar has happy class
    const avatar = page.locator('.cc-sarah__avatar');
    await expect(avatar).toHaveClass(/cc-sarah__avatar--happy/);
  });

  test('TC-F3-10: should auto-dismiss Barbarian alert banner after 6.5s (6500ms) delay', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.locator('.cc-sarah__action-btn').click();

    // Mock negative action to trigger Barbarian Guard alert
    await mockAnalyzeIntent(page, {
      impactScore: -10,
      category: 'waste',
      remedy: 'Methane CH4 is rising! Compost your waste!'
    });

    const input = page.locator('#action-input');
    await input.fill('I threw organic food in landfill');
    await page.locator('#submit-action').click();

    const alert = page.locator('.cc-barbarian__panel');
    await expect(alert).toBeVisible();

    // Fast forward 6000ms (6.0s) - alert should still be visible
    await page.clock.fastForward(6000);
    await expect(alert).toBeVisible();

    // Fast forward another 500ms (to 6500ms total)
    await page.clock.fastForward(500);
    await expect(alert).not.toBeVisible();
  });
});
