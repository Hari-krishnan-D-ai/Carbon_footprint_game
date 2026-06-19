import { test, expect } from '@playwright/test';
import { getThreeJsState, mockAnalyzeIntent } from './helpers.js';

test.describe('Tier 4: Real-World Application Scenarios', () => {

  test('TC-SC-01: First-Time User Onboarding Flow', async ({ page }) => {
    await page.goto('/');

    // 1. Initially, user is not onboarded
    const onboardingBtn = page.locator('.cc-sarah__action-btn');
    await expect(onboardingBtn).toBeVisible();
    await expect(onboardingBtn).toHaveText("Let's go! 🚀");

    const textLocator = page.locator('.cc-sarah__text');
    await expect(textLocator).toContainText("Hi! I'm Sarah 🌱 Welcome to our village!");

    // 2. Click dismiss button
    await onboardingBtn.click();

    // 3. User is onboarded and idle message is shown
    await expect(onboardingBtn).not.toBeVisible();
    const hasOnboarded = await page.evaluate(() => window.useGameStore.getState().hasOnboarded);
    expect(hasOnboarded).toBe(true);

    // Default idle message should be visible
    await expect(textLocator).toContainText("The Town Hall stands at 75%");
  });

  test('TC-SC-02: Action Reporting - Planting a Tree Scenario', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cc-sarah__action-btn').click();

    // Mock API response for planting a tree
    await mockAnalyzeIntent(page, {
      impactScore: 12,
      category: 'general',
      remedy: 'Superb! Trees absorb CO2.'
    });

    const input = page.locator('#action-input');
    await input.fill('I planted a pine tree in my garden');
    await page.locator('#submit-action').click();

    // 1. Sarah goes into celebrating mode
    const avatar = page.locator('.cc-sarah__avatar');
    await expect(avatar).toHaveClass(/cc-sarah__avatar--celebrating/);

    // 2. Zustand store updates trees count and town hall health
    const storeState = await page.evaluate(() => {
      const s = window.useGameStore.getState();
      return {
        plantedTreesCount: s.plantedTreesCount,
        townHallHealth: s.townHallHealth,
        pollutionFactor: s.pollutionFactor
      };
    });

    expect(storeState.plantedTreesCount).toBe(1);
    // Initial health 75. 75 + 12 = 87
    expect(storeState.townHallHealth).toBe(87);
    // Initial pollution 25. 25 - 12 (impact) - 30 (tree bonus) = clamped to 0
    expect(storeState.pollutionFactor).toBe(0);
  });

  test('TC-SC-03: High Carbon Alert (Raid Warning) Scenario', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cc-sarah__action-btn').click();

    // Mock negative travel intent (motorbike / gasoline engine)
    await mockAnalyzeIntent(page, {
      impactScore: -20,
      category: 'travel',
      remedy: 'The CO2 ghost is coming for you! Walk or bike instead!'
    });

    const input = page.locator('#action-input');
    await input.fill('I drove a gasoline motorbike all day');
    await page.locator('#submit-action').click();

    // 1. Red evil background flash is triggered
    // Since it turns off after 1 second, it should have flashed or let's wait a bit.
    // 2. Barbarian Alert panel slides in showing the CO2 warning remedy
    const alertPanel = page.locator('.cc-barbarian__panel');
    await expect(alertPanel).toBeVisible();
    await expect(page.locator('.cc-barbarian__headline')).toHaveText('Save the future!');
    await expect(page.locator('.cc-barbarian__text')).toHaveText('The CO2 ghost is coming for you! Walk or bike instead!');

    // 3. Sarah's mood is worried
    const avatar = page.locator('.cc-sarah__avatar');
    await expect(avatar).toHaveClass(/cc-sarah__avatar--worried/);

    // 4. Fog limits contract (pollution increases)
    // Initial 25. impact -20 adds 20 pollution, total 45.
    // targetNear = 10 - 0.45 * 5 = 7.75
    // targetFar = 30 - 0.45 * 14 = 23.7
    await page.waitForTimeout(2000);
    const state = await getThreeJsState(page);
    expect(state.scene.fog.near).toBeLessThan(8.5);
    expect(state.scene.fog.far).toBeLessThan(25.5);
  });

  test('TC-SC-04: Mobile Device Viewport Navigation Scenario', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cc-sarah__action-btn').click();

    // Set mobile phone screen dimensions
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(500);

    // 1. Verify camera zoom limit
    const threeState = await getThreeJsState(page);
    expect(threeState.hasCamera).toBe(true);
    const [x, y, z] = threeState.camera.position;
    // Multiplier = 1.6 / (360/640) = 2.84, clamped to 2.2
    expect(x).toBeCloseTo(6 * 2.2, 1);

    // 2. Verify dialog layout adjusts
    const container = page.locator('.cc-sarah__container');
    await expect(container).toBeVisible();

    // 3. Report a negative action to trigger Barbarian guard alert
    await mockAnalyzeIntent(page, {
      impactScore: -10,
      category: 'waste',
      remedy: 'Methane CH4 is rising! Recycle plastic!'
    });

    const input = page.locator('#action-input');
    await input.fill('I threw plastic bottles in the lake');
    await page.locator('#submit-action').click();

    // Barbarian modal should fit on screen in central layout
    const alertPanel = page.locator('.cc-barbarian__panel');
    await expect(alertPanel).toBeVisible();
    
    // Check it uses center layout (top: 40% / left: 50% / transform: translate(-50%, -50%))
    const alert = page.locator('.cc-barbarian');
    const transform = await alert.evaluate(el => window.getComputedStyle(el).transform);
    // It should have matrix translation indicating transform is active
    expect(transform).toContain('matrix');
  });

  test('TC-SC-05: Continuous Degradation and Recovery Flow Scenario', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cc-sarah__action-btn').click();

    // Step 1: Harmful action (travel)
    await mockAnalyzeIntent(page, {
      impactScore: -15,
      category: 'travel',
      remedy: 'The CO2 ghost is coming for you! Avoid gas engines.'
    });

    let input = page.locator('#action-input');
    await input.fill('I left the diesel truck running');
    await page.locator('#submit-action').click();

    // Verify health drops and pollution increases
    let storeState = await page.evaluate(() => {
      const s = window.useGameStore.getState();
      return { health: s.townHallHealth, pollution: s.pollutionFactor };
    });
    // Initial: health 75, pollution 25
    // After -15 impact: health 60, pollution 40
    expect(storeState.health).toBe(60);
    expect(storeState.pollution).toBe(40);

    // Acknowledge Barbarian warning
    await page.locator('.cc-barbarian__dismiss').click();

    // Step 2: Another harmful action (waste)
    await mockAnalyzeIntent(page, {
      impactScore: -10,
      category: 'waste',
      remedy: 'CH4 is leaking! Compost your food wastes!'
    });

    input = page.locator('#action-input');
    await input.fill('I dumped food wastes in regular bin');
    await page.locator('#submit-action').click();

    storeState = await page.evaluate(() => {
      const s = window.useGameStore.getState();
      return { health: s.townHallHealth, pollution: s.pollutionFactor };
    });
    // After another -10 impact: health 50, pollution 50
    expect(storeState.health).toBe(50);
    expect(storeState.pollution).toBe(50);

    // Acknowledge Barbarian warning again
    await page.locator('.cc-barbarian__dismiss').click();

    // Step 3: Recovery action (diet/general)
    await mockAnalyzeIntent(page, {
      impactScore: 20,
      category: 'diet',
      remedy: 'Fabulous! You chose vegan diet!'
    });

    input = page.locator('#action-input');
    await input.fill('I ate vegan meals for a week');
    await page.locator('#submit-action').click();

    storeState = await page.evaluate(() => {
      const s = window.useGameStore.getState();
      return { health: s.townHallHealth, pollution: s.pollutionFactor, mood: s.sarahMood };
    });
    // After +20 impact: health 70, pollution 30
    expect(storeState.health).toBe(70);
    expect(storeState.pollution).toBe(30);
    expect(storeState.mood).toBe('celebrating');
  });

  test('TC-SC-06: Incorrect Intent Fallback and Recovery Scenario', async ({ page }) => {
    await page.goto('/');
    await page.locator('.cc-sarah__action-btn').click();

    // Mock API returning server error (500)
    await page.route('**/api/analyze-intent', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server unavailable' }),
      });
    });

    const input = page.locator('#action-input');
    await input.fill('some gibberish input');
    await page.locator('#submit-action').click();

    // System should fallback gracefully.
    // geminiClient returns a result with impactScore 0, category 'unknown', remedy 'Stand your ground!'
    const textLocator = page.locator('.cc-sarah__text');
    await expect(textLocator).toContainText('The Town Hall stands at 75%');
    
    // Check that isProcessing goes back to false and game does not lock up
    const isProcessing = await page.evaluate(() => window.useGameStore.getState().isProcessing);
    expect(isProcessing).toBe(false);

    // Now, recover: mock a valid call and submit again
    await mockAnalyzeIntent(page, {
      impactScore: 8,
      category: 'travel',
      remedy: 'Nice! Public transport is eco-friendly.'
    });

    await input.fill('I took the public train');
    await page.locator('#submit-action').click();

    // It should update successfully
    const health = await page.evaluate(() => window.useGameStore.getState().townHallHealth);
    expect(health).toBe(83); // 75 + 8
  });
});
