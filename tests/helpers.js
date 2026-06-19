export async function getThreeJsState(page) {
  // Wait for canvas to exist and __r3f or window objects to be ready
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    if (window.__controls && window.__camera && window.__scene) return true;
    return !!(canvas.__r3f && canvas.__r3f.store);
  }, { timeout: 15000 }).catch(() => {});

  return await page.evaluate(() => {
    let controls = window.__controls;
    let camera = window.__camera;
    let scene = window.__scene;

    const canvas = document.querySelector('canvas');
    if (canvas && canvas.__r3f && canvas.__r3f.store) {
      const r3fState = canvas.__r3f.store.getState();
      if (!controls) controls = r3fState.controls;
      if (!camera) camera = r3fState.camera;
      if (!scene) scene = r3fState.scene;
    }

    const result = {
      hasControls: !!controls,
      hasCamera: !!camera,
      hasScene: !!scene,
      controls: null,
      camera: null,
      scene: null,
    };

    if (controls) {
      result.controls = {
        minPolarAngle: controls.minPolarAngle,
        maxPolarAngle: controls.maxPolarAngle,
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        enablePan: controls.enablePan,
        enableZoom: controls.enableZoom,
        target: controls.target ? [controls.target.x, controls.target.y, controls.target.z] : null,
      };
    }

    if (camera) {
      result.camera = {
        position: camera.position ? [camera.position.x, camera.position.y, camera.position.z] : null,
        fov: camera.fov,
        near: camera.near,
        far: camera.far,
      };
    }

    if (scene) {
      const fog = scene.fog;
      result.scene = {
        hasFog: !!fog,
        fog: fog ? {
          color: fog.color && typeof fog.color.getHexString === 'function' ? fog.color.getHexString() : null,
          near: fog.near,
          far: fog.far,
        } : null,
        background: scene.background && typeof scene.background.getHexString === 'function' ? scene.background.getHexString() : null,
        ground: null,
      };

      // Traverse scene to find ground geometry
      let groundRadius = null;
      let groundRadialSegments = null;
      scene.traverse((obj) => {
        if (obj.isMesh && obj.geometry && (obj.geometry.type === 'CircleGeometry' || obj.geometry.type === 'CircleBufferGeometry')) {
          groundRadius = obj.geometry.parameters.radius;
          groundRadialSegments = obj.geometry.parameters.segments;
        }
      });
      result.scene.ground = {
        radius: groundRadius,
        radialSegments: groundRadialSegments,
      };
    }

    return result;
  });
}

export async function mockAnalyzeIntent(page, responseData) {
  await page.route('**/api/analyze-intent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    });
  });
}
