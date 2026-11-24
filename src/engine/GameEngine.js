import * as THREE from 'three';
import { createWasmPhysicsEngine } from '../wasm/physicsWasm';
import { createRealisticTextures } from './textureGen';
import { WEAPONS, DEPLOY_LOCATIONS } from './arsenalData';
import { soundEngine } from './soundEngine';

export class GameEngine {
  constructor(container, callbacks, initialLoadout, spawnLocationId = 'crossroads') {
    this.container = container;
    this.callbacks = callbacks;
    this.loadout = initialLoadout;

    const spawnCfg = DEPLOY_LOCATIONS.find((loc) => loc.id === spawnLocationId) || DEPLOY_LOCATIONS[0];
    const weaponDef = WEAPONS.find((w) => w.id === this.loadout.equippedWeaponId) || WEAPONS[0];
    const magBonus = (this.loadout.upgrades.magSize - 1) * 6;
    const fireRateMult = Math.pow(0.86, this.loadout.upgrades.fireRate - 1);
    const reloadMult = Math.pow(0.85, this.loadout.upgrades.reloadSpeed - 1);

    this.activeWeapon = {
      ...weaponDef,
      computedMaxAmmo: weaponDef.baseMag + magBonus,
      computedFireRateMs: Math.max(55, Math.round(weaponDef.fireRateMs * fireRateMult)),
      computedReloadMs: Math.max(350, Math.round(weaponDef.baseReloadMs * reloadMult))
    };

    this.scene = new THREE.Scene();
    this.baseFov = 74;
    this.scopeFov = this.activeWeapon.scopeZoomFov || 48;
    this.camera = new THREE.PerspectiveCamera(
      this.baseFov,
      Math.max(1, container.clientWidth || window.innerWidth) / Math.max(1, container.clientHeight || window.innerHeight),
      0.08,
      460
    );
    this.camera.rotation.order = 'YXZ';

    this.renderer = null;
    this.wasmPhysics = null;
    this.textures = null;

    this.standingEyeHeight = 1.78;
    this.crouchEyeHeight = 0.94;
    this.player = {
      pos: new THREE.Vector3(spawnCfg.x, 1.78, spawnCfg.z),
      vel: new THREE.Vector3(0, 0, 0),
      yaw: spawnCfg.yaw || 0,
      pitch: 0,
      currentEyeHeight: 1.78,
      onGround: true,
      inCover: false,
      isScoped: false,
      hp: 150,
      maxHp: 150,
      ammo: this.activeWeapon.computedMaxAmmo,
      maxAmmo: this.activeWeapon.computedMaxAmmo,
      reserveAmmo: 120,
      reloading: false,
      lastShotTime: 0,
      lastDamageTime: 0,
      spawnProtectionTimer: 3.0, // 3 seconds of safe arrival protection on deploy!
      score: 0
    };

    this.keys = {};
    this.touchMove = { x: 0, y: 0 };
    this.weaponRecoil = 0;
    this.weaponBobTime = 0;
    this.muzzleFlashTimer = 0;
    this.shellCasings = [];

    this.blockers = [];
    this.enemies = [];
    this.mainSwitches = [];
    this.projectiles = [];
    this.particles = [];
    this.shootableMeshes = [];

    this.isRunning = false;
    this.disposed = false;
    this.isGameOver = false;
    this.isVictory = false;
    this.lastTime = performance.now();
    this.fpsCounter = { frames: 0, lastCheck: performance.now(), value: 60 };
  }

  async init() {
    if (this.disposed || !this.container) return;

    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    const canvas = this.renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    Array.from(this.container.querySelectorAll('canvas')).forEach((el) => el.remove());
    this.container.appendChild(canvas);

    this.textures = createRealisticTextures();
    this.setupAtmosphereAndLights();
    this.buildOpenWorld();
    this.buildRealisticWeaponAndHands();
    this.spawnEnemiesAndSwitches();

    this.camera.position.copy(this.player.pos);
    this.renderer.render(this.scene, this.camera);
    this.syncHud();

    this.wasmPhysics = await createWasmPhysicsEngine(this.blockers);
    if (this.disposed) return;

    window.addEventListener('resize', this.handleResize);
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  setupAtmosphereAndLights() {
    this.scene.background = new THREE.Color(0x87CEFA);
    this.scene.fog = new THREE.FogExp2(0x9AD4F5, 0.0036);

    const hemiLight = new THREE.HemisphereLight(0xF0F9FF, 0x3D523A, 1.18);
    hemiLight.position.set(0, 100, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xFFF7E8, 2.0);
    sunLight.position.set(70, 110, 55);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.bias = -0.0005;
    const d = 135;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);
  }

  buildOpenWorld() {
    // Expansive 320m x 320m Open World Ground with wide avenues for walking & tactical flanking
    const groundGeo = new THREE.PlaneGeometry(320, 320);
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.textures.groundMap,
      roughness: 0.9,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const roadMat = new THREE.MeshStandardMaterial({
      map: this.textures.roadMap,
      roughness: 0.78,
      metalness: 0.1
    });
    // Wide 16m highways connecting all 4 sectors
    const mainHighwayNS = new THREE.Mesh(new THREE.BoxGeometry(16, 0.06, 240), roadMat);
    mainHighwayNS.position.set(0, 0.03, 0);
    mainHighwayNS.receiveShadow = true;
    this.scene.add(mainHighwayNS);

    const mainHighwayEW = new THREE.Mesh(new THREE.BoxGeometry(240, 0.06, 16), roadMat);
    mainHighwayEW.position.set(0, 0.03, -12);
    mainHighwayEW.receiveShadow = true;
    this.scene.add(mainHighwayEW);

    // Outer Fortress Boundary Wall (125m radius enclosing the entire open world)
    const bound = 125;
    this.addBlocker(0, -bound, 254, 10, 4, 0x4A5560, 'mountain', 'wall');
    this.addBlocker(0, bound, 254, 10, 4, 0x4A5560, 'mountain', 'wall');
    this.addBlocker(-bound, 0, 4, 10, 254, 0x4A5560, 'mountain', 'wall');
    this.addBlocker(bound, 0, 4, 10, 254, 0x4A5560, 'mountain', 'wall');

    // =====================================================================
    // SECTOR 1 (SOUTH): CENTRAL CROSSROADS SAFE-ZONE & WIDE TACTICAL LANE
    // Plenty of space to walk, hide behind waist-high barricades, and peek
    // =====================================================================
    this.addBlocker(-6, 56, 5.2, 1.42, 1.4, 0x58CC02, 'port', 'cover');
    this.addBlocker(6, 56, 5.2, 1.42, 1.4, 0x58CC02, 'port', 'cover');
    this.addBlocker(0, 42, 6.0, 1.42, 1.4, 0x1CB0F6, 'port', 'cover');
    this.addBlocker(-14, 34, 5.0, 3.8, 5.0, 0x4A6B82, 'port', 'bunker');
    this.addBlocker(14, 34, 5.0, 3.8, 5.0, 0x4A6B82, 'port', 'bunker');
    this.addBlocker(-7, 22, 5.0, 1.42, 1.4, 0xFFC800, 'port', 'cover');
    this.addBlocker(7, 22, 5.0, 1.42, 1.4, 0xFFC800, 'port', 'cover');

    // =====================================================================
    // SECTOR 2 (NORTH): ANCIENT CITADEL FORT (Wide 76m x 64m Courtyard)
    // =====================================================================
    const fortFloor = new THREE.Mesh(
      new THREE.BoxGeometry(76, 0.08, 64),
      new THREE.MeshStandardMaterial({ map: this.textures.fortStoneMap, color: 0xC9B18A, roughness: 0.85 })
    );
    fortFloor.position.set(0, 0.04, -76);
    fortFloor.receiveShadow = true;
    this.scene.add(fortFloor);

    // Fort Outer Gatehouse Walls with wide 22m center entrance
    this.addBlocker(-24, -46, 26, 5.6, 3.4, 0xD4B483, 'fort', 'bunker');
    this.addBlocker(24, -46, 26, 5.6, 3.4, 0xD4B483, 'fort', 'bunker');
    // Corner Guard Towers
    this.addBlocker(-36, -46, 7.0, 8.8, 7.0, 0xB89463, 'fort', 'tower');
    this.addBlocker(36, -46, 7.0, 8.8, 7.0, 0xB89463, 'fort', 'tower');
    this.addBlocker(-36, -104, 7.0, 8.8, 7.0, 0xB89463, 'fort', 'tower');
    this.addBlocker(36, -104, 7.0, 8.8, 7.0, 0xB89463, 'fort', 'tower');
    // Waist-high sandstone cover walls & courtyard pillars for hiding
    this.addBlocker(-10, -58, 5.4, 1.42, 1.5, 0xE0A958, 'fort', 'cover');
    this.addBlocker(10, -58, 5.4, 1.42, 1.5, 0xE0A958, 'fort', 'cover');
    this.addBlocker(-18, -74, 4.5, 4.8, 4.5, 0xC49A64, 'fort', 'bunker');
    this.addBlocker(18, -74, 4.5, 4.8, 4.5, 0xC49A64, 'fort', 'bunker');
    this.addBlocker(0, -78, 6.0, 1.42, 1.5, 0xE0A958, 'fort', 'cover');

    // =====================================================================
    // SECTOR 3 (WEST): HARBOR CONTAINER PORT (Wide Container Alleys)
    // =====================================================================
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0E7490,
      roughness: 0.18,
      metalness: 0.65
    });
    const harborWater = new THREE.Mesh(new THREE.BoxGeometry(28, 0.12, 98), waterMat);
    harborWater.position.set(-104, 0.06, -12);
    this.scene.add(harborWater);

    const pierDeck = new THREE.Mesh(
      new THREE.BoxGeometry(56, 0.14, 94),
      new THREE.MeshStandardMaterial({ map: this.textures.roadMap, color: 0x64748B, roughness: 0.8 })
    );
    pierDeck.position.set(-62, 0.07, -12);
    pierDeck.receiveShadow = true;
    this.scene.add(pierDeck);

    // Wide alleys (14m+ spacing) between shipping containers + yellow cover barriers
    this.addBlocker(-46, -34, 3.6, 3.4, 9.5, 0xE63946, 'port', 'bunker');
    this.addBlocker(-46, 16, 3.6, 3.4, 9.5, 0x1CB0F6, 'port', 'bunker');
    this.addBlocker(-68, -28, 3.6, 6.4, 9.5, 0xFF9600, 'port', 'tower');
    this.addBlocker(-68, 12, 3.6, 3.4, 9.5, 0x2A9D8F, 'port', 'bunker');
    this.addBlocker(-56, -10, 5.2, 1.42, 1.5, 0xFFC800, 'port', 'cover');
    this.addBlocker(-78, -10, 5.2, 1.42, 1.5, 0xFFC800, 'port', 'cover');

    // =====================================================================
    // SECTOR 4 (EAST): REMOTE MOUNTAIN OUTPOST (Spacious Alpine Ridge)
    // =====================================================================
    const mtnFloor = new THREE.Mesh(
      new THREE.BoxGeometry(66, 0.1, 90),
      new THREE.MeshStandardMaterial({ map: this.textures.mountainRockMap, color: 0x7A848E, roughness: 0.92 })
    );
    mtnFloor.position.set(76, 0.05, -12);
    mtnFloor.receiveShadow = true;
    this.scene.add(mtnFloor);

    this.addMountainPeak(104, -40, 15, 24);
    this.addMountainPeak(106, 20, 16, 27);
    this.addMountainPeak(88, -52, 12, 18);
    this.addMountainPeak(88, 32, 12, 19);

    this.addBlocker(48, -30, 4.8, 4.8, 9.5, 0x6C757D, 'mountain', 'bunker');
    this.addBlocker(48, 12, 4.8, 4.8, 9.5, 0x6C757D, 'mountain', 'bunker');
    this.addBlocker(64, -10, 5.4, 1.42, 1.5, 0x8D99AE, 'mountain', 'cover');
    this.addBlocker(80, -24, 5.5, 4.2, 5.5, 0x5C677D, 'mountain', 'bunker');
    this.addBlocker(80, 6, 5.5, 4.2, 5.5, 0x5C677D, 'mountain', 'bunker');

    this.addWorldElements();
  }

  addMountainPeak(x, z, radius, height) {
    const geo = new THREE.ConeGeometry(radius, height, 7);
    const mat = new THREE.MeshStandardMaterial({
      map: this.textures.mountainRockMap,
      color: 0x6C7680,
      roughness: 0.92
    });
    const peak = new THREE.Mesh(geo, mat);
    peak.position.set(x, height / 2, z);
    peak.castShadow = true;
    peak.receiveShadow = true;
    this.scene.add(peak);

    const snowGeo = new THREE.ConeGeometry(radius * 0.36, height * 0.32, 7);
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.6 });
    const snow = new THREE.Mesh(snowGeo, snowMat);
    snow.position.set(0, height * 0.34, 0);
    peak.add(snow);

    const half = radius * 0.65;
    this.blockers.push({
      minX: x - half,
      maxX: x + half,
      minZ: z - half,
      maxZ: z + half,
      height,
      kind: 'bunker',
      mesh: peak
    });
  }

  addWorldElements() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2D6A4F, roughness: 0.8 });

    const treeCoords = [
      [-24, 54], [24, 54], [-30, 72], [30, 72],
      [-28, -22], [28, -22], [36, -44], [38, 38],
      [-38, 48], [56, 46], [56, -48], [-52, -58]
    ];

    treeCoords.forEach(([tx, tz]) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.2, 8), trunkMat);
      trunk.position.y = 1.6;
      trunk.castShadow = true;
      tree.add(trunk);

      const tier1 = new THREE.Mesh(new THREE.ConeGeometry(2.4, 4.2, 8), foliageMat);
      tier1.position.y = 4.6;
      tier1.castShadow = true;
      tree.add(tier1);

      const tier2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.4, 8), foliageMat);
      tier2.position.y = 7.0;
      tier2.castShadow = true;
      tree.add(tier2);

      this.scene.add(tree);

      this.blockers.push({
        minX: tx - 0.7,
        maxX: tx + 0.7,
        minZ: tz - 0.7,
        maxZ: tz + 0.7,
        height: 8.5,
        kind: 'bunker',
        mesh: trunk
      });
    });
  }

  addBlocker(x, z, width, height, depth, color, biome = 'port', kind = 'bunker') {
    let map = this.textures.containerMap;
    if (biome === 'fort') map = this.textures.fortStoneMap;
    else if (biome === 'mountain') map = this.textures.mountainRockMap;

    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({
      color,
      map,
      roughness: 0.65,
      metalness: biome === 'port' ? 0.35 : 0.12
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const trimMat = new THREE.MeshStandardMaterial({
      map: this.textures.metalMap,
      color: kind === 'cover' ? 0xFFC800 : 0x2B3842,
      roughness: 0.4,
      metalness: 0.65
    });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.16, depth + 0.14), trimMat);
    cap.position.y = height / 2;
    mesh.add(cap);

    this.scene.add(mesh);

    this.blockers.push({
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2,
      height,
      kind,
      mesh
    });
  }

  buildRealisticWeaponAndHands() {
    this.weaponGroup = new THREE.Group();

    const gunMetalMat = new THREE.MeshStandardMaterial({
      map: this.textures.metalMap,
      color: 0x26313A,
      roughness: 0.28,
      metalness: 0.85
    });
    const polymerMat = new THREE.MeshStandardMaterial({
      color: 0x1B242B,
      roughness: 0.58,
      metalness: 0.2
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: this.activeWeapon.color,
      roughness: 0.32,
      metalness: 0.45
    });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x353E45, roughness: 0.75 });
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1E4D2B, roughness: 0.8 });

    const modelType = this.activeWeapon.modelType || 'pistol';

    if (modelType === 'pistol') {
      // GLOCK-18 TACTICAL HANDGUN + TWO-HANDED PISTOL GRIP
      const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.054, 0.34, 12), sleeveMat);
      rightArm.rotation.x = Math.PI / 2.25;
      rightArm.position.set(0.04, -0.14, 0.24);
      this.weaponGroup.add(rightArm);

      const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 0.34, 12), sleeveMat);
      leftArm.rotation.x = Math.PI / 2.25;
      leftArm.rotation.z = -0.22;
      leftArm.position.set(-0.07, -0.14, 0.22);
      this.weaponGroup.add(leftArm);

      const hands = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.09, 0.11), gloveMat);
      hands.position.set(-0.005, -0.08, 0.02);
      this.weaponGroup.add(hands);

      // Glock Frame & Grip
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.13, 0.062), polymerMat);
      grip.rotation.x = 0.22;
      grip.position.set(0, -0.065, -0.01);
      this.weaponGroup.add(grip);

      const lowerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.032, 0.24), polymerMat);
      lowerFrame.position.set(0, 0.002, -0.10);
      this.weaponGroup.add(lowerFrame);

      // Glock Slide (Square profile with accent stripe)
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.044, 0.25), gunMetalMat);
      slide.position.set(0, 0.036, -0.105);
      this.weaponGroup.add(slide);

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.01, 0.18), accentMat);
      stripe.position.set(0, 0.038, -0.11);
      this.weaponGroup.add(stripe);

      // Reflex Sight / Iron Sight on Top of Slide
      const sightGlow = new THREE.MeshBasicMaterial({ color: 0x58CC02 });
      const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.014), sightGlow);
      frontSight.position.set(0, 0.064, -0.215);
      this.weaponGroup.add(frontSight);

      const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.012), gunMetalMat);
      rearSight.position.set(0, 0.064, 0.005);
      this.weaponGroup.add(rearSight);

      const flashMat = new THREE.MeshBasicMaterial({ color: 0xFFE66D, transparent: true, opacity: 0 });
      this.muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), flashMat);
      this.muzzleFlash.position.set(0, 0.038, -0.27);
      this.weaponGroup.add(this.muzzleFlash);

      this.hipWeaponPos = new THREE.Vector3(0.21, -0.21, -0.34);
      this.adsWeaponPos = new THREE.Vector3(0.0, -0.11, -0.28);
    } else if (modelType === 'smg') {
      // VIPER MP5 COMPACT SUBMACHINE GUN
      const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.056, 0.34, 12), sleeveMat);
      rightArm.rotation.x = Math.PI / 2.35;
      rightArm.position.set(0.05, -0.14, 0.23);
      this.weaponGroup.add(rightArm);

      const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.11), gloveMat);
      rightHand.position.set(0.01, -0.08, 0.04);
      this.weaponGroup.add(rightHand);

      const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.075, 0.10), gloveMat);
      leftHand.position.set(-0.02, -0.05, -0.18);
      this.weaponGroup.add(leftHand);

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.082, 0.34), gunMetalMat);
      body.position.set(0, 0.01, -0.11);
      this.weaponGroup.add(body);

      const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.068, 0.16), accentMat);
      shroud.position.set(0, 0.01, -0.25);
      this.weaponGroup.add(shroud);

      // Curved SMG Magazine
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.19, 0.052), polymerMat);
      mag.rotation.x = 0.26;
      mag.position.set(0, -0.12, -0.14);
      this.weaponGroup.add(mag);

      // Compact Red-Dot Sight
      const redDotFrame = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.042, 0.075), gunMetalMat);
      redDotFrame.position.set(0, 0.072, -0.08);
      this.weaponGroup.add(redDotFrame);

      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.018, 14),
        new THREE.MeshBasicMaterial({ color: 0x1CB0F6, transparent: true, opacity: 0.75 })
      );
      lens.position.set(0, 0.072, -0.041);
      this.weaponGroup.add(lens);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.14, 12), gunMetalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.015, -0.38);
      this.weaponGroup.add(barrel);

      const flashMat = new THREE.MeshBasicMaterial({ color: 0xFFE66D, transparent: true, opacity: 0 });
      this.muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), flashMat);
      this.muzzleFlash.position.set(0, 0.015, -0.48);
      this.weaponGroup.add(this.muzzleFlash);

      this.hipWeaponPos = new THREE.Vector3(0.23, -0.22, -0.35);
      this.adsWeaponPos = new THREE.Vector3(0.0, -0.115, -0.24);
    } else {
      // CARBINE OR SNIPER RIFLE
      const isSniper = modelType === 'sniper';
      const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.34, 12), sleeveMat);
      rightArm.rotation.x = Math.PI / 2.4;
      rightArm.position.set(0.05, -0.14, 0.24);
      this.weaponGroup.add(rightArm);

      const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.095, 0.12), gloveMat);
      rightHand.position.set(0.01, -0.085, 0.05);
      this.weaponGroup.add(rightHand);

      const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.08, 0.11), gloveMat);
      leftHand.position.set(-0.03, -0.055, -0.22);
      this.weaponGroup.add(leftHand);

      const upperReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.076, 0.092, 0.48), gunMetalMat);
      upperReceiver.position.set(0, 0.01, -0.12);
      this.weaponGroup.add(upperReceiver);

      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.17, 0.082), polymerMat);
      mag.rotation.x = 0.22;
      mag.position.set(0, -0.13, -0.11);
      this.weaponGroup.add(mag);

      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.08, isSniper ? 0.36 : 0.28), accentMat);
      handguard.position.set(0, 0.012, isSniper ? -0.40 : -0.36);
      this.weaponGroup.add(handguard);

      const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, isSniper ? 0.26 : 0.16, 16), gunMetalMat);
      scopeTube.rotation.x = Math.PI / 2;
      scopeTube.position.set(0, 0.11, -0.08);
      this.weaponGroup.add(scopeTube);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, isSniper ? 0.34 : 0.22, 14), gunMetalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.018, isSniper ? -0.68 : -0.56);
      this.weaponGroup.add(barrel);

      const flashMat = new THREE.MeshBasicMaterial({ color: 0xFFE66D, transparent: true, opacity: 0 });
      this.muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), flashMat);
      this.muzzleFlash.position.set(0, 0.018, isSniper ? -0.88 : -0.72);
      this.weaponGroup.add(this.muzzleFlash);

      this.hipWeaponPos = new THREE.Vector3(0.25, -0.23, -0.36);
      this.adsWeaponPos = new THREE.Vector3(0.0, -0.14, -0.22);
    }

    this.weaponGroup.position.copy(this.hipWeaponPos);
    this.camera.add(this.weaponGroup);
    this.scene.add(this.camera);
  }

  spawnEnemiesAndSwitches() {
    // Sector-isolated Drones: each drone guards only its own sector and will NOT swarm across the map!
    const droneSpawns = [
      // Sector 1 (Central Crossroads outer edge - far from spawn)
      { x: 0, y: 2.8, z: 6, patrolRadius: 6, speed: 1.05, leashRadius: 24 },
      // Sector 2 (North Fort)
      { x: -14, y: 3.1, z: -64, patrolRadius: 7, speed: 1.15, leashRadius: 28 },
      { x: 14, y: 3.1, z: -86, patrolRadius: 7, speed: 1.15, leashRadius: 28 },
      // Sector 3 (West Harbor Port)
      { x: -58, y: 3.0, z: -22, patrolRadius: 7, speed: 1.1, leashRadius: 26 },
      // Sector 4 (East Mountain Outpost)
      { x: 68, y: 3.2, z: -18, patrolRadius: 7, speed: 1.1, leashRadius: 26 }
    ];
    droneSpawns.forEach((cfg, idx) => this.createDrone(cfg, idx));

    // Sector-isolated Laser Cameras: each only watches a 20m zone directly in front of its mount
    const cameraSpawns = [
      { x: -14, y: 3.2, z: 31.4, baseYaw: 0 },
      { x: 14, y: 3.2, z: 31.4, baseYaw: 0 },
      { x: -12, y: 4.5, z: -44.2, baseYaw: 0 },
      { x: 12, y: 4.5, z: -44.2, baseYaw: 0 },
      { x: -44.2, y: 3.2, z: -10, baseYaw: Math.PI / 2 },
      { x: 45.5, y: 4.2, z: -10, baseYaw: -Math.PI / 2 }
    ];
    cameraSpawns.forEach((cfg, idx) => this.createLaserCamera(cfg, idx));

    // 3 Glowing Main Reactor Switches in Fort, Port, and Mountain Outpost
    const switchLocations = [
      { id: 'switch_fort', name: 'FORT REACTOR SWITCH', x: 0, z: -92, coinReward: 250, ammoReward: 48 },
      { id: 'switch_port', name: 'PORT HARBOR SWITCH', x: -82, z: -10, coinReward: 250, ammoReward: 48 },
      { id: 'switch_mountain', name: 'MOUNTAIN RELAY SWITCH', x: 92, z: -8, coinReward: 300, ammoReward: 60 }
    ];
    switchLocations.forEach((sw) => this.createMainSwitch(sw));
  }

  createMainSwitch(cfg) {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);

    const baseMat = new THREE.MeshStandardMaterial({
      map: this.textures.metalMap,
      color: 0x202F36,
      metalness: 0.8,
      roughness: 0.3
    });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 1.4, 12), baseMat);
    pedestal.position.y = 0.7;
    pedestal.castShadow = true;
    group.add(pedestal);

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xFF4B4B,
      emissive: 0xFF2222,
      emissiveIntensity: 0.85,
      roughness: 0.2
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 1), coreMat);
    core.position.y = 2.25;
    core.userData.switchId = cfg.id;
    group.add(core);
    this.shootableMeshes.push(core);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xFFC800 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 8, 24), ringMat);
    ring.position.y = 2.25;
    ring.userData.switchId = cfg.id;
    group.add(ring);
    this.shootableMeshes.push(ring);

    const beaconGeo = new THREE.CylinderGeometry(0.18, 0.18, 48, 8, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xFFC800,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 24;
    group.add(beacon);

    this.scene.add(group);

    this.mainSwitches.push({
      ...cfg,
      group,
      core,
      ring,
      hp: 85,
      maxHp: 85,
      destroyed: false
    });
  }

  createDrone(cfg, idx) {
    const group = new THREE.Group();
    group.position.set(cfg.x, cfg.y, cfg.z);

    const armorMat = new THREE.MeshStandardMaterial({
      map: this.textures.metalMap,
      color: 0x26323C,
      roughness: 0.28,
      metalness: 0.78
    });
    const hull = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 20), armorMat);
    hull.castShadow = true;
    hull.userData.enemyId = `drone_${idx}`;
    group.add(hull);
    this.shootableMeshes.push(hull);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1CB0F6 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), eyeMat);
    eye.position.set(0, 0, 0.52);
    eye.userData.enemyId = `drone_${idx}`;
    group.add(eye);
    this.shootableMeshes.push(eye);

    const rotors = [];
    const thrusterMat = new THREE.MeshStandardMaterial({ color: 0xFF9600, roughness: 0.35, metalness: 0.4 });
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0xE5E5E5, transparent: true, opacity: 0.65 });

    [-0.88, 0.88].forEach((rx) => {
      const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 16), thrusterMat);
      shroud.position.set(rx, 0.15, 0);
      shroud.userData.enemyId = `drone_${idx}`;
      group.add(shroud);
      this.shootableMeshes.push(shroud);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.015, 0.07), bladeMat);
      blade.position.set(rx, 0.24, 0);
      group.add(blade);
      rotors.push(blade);
    });

    const beamGeo = new THREE.CylinderGeometry(0.03, 0.36, 17, 12, 1, true);
    beamGeo.translate(0, -8.5, 0);
    beamGeo.rotateX(-Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x1CB0F6,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const scanBeam = new THREE.Mesh(beamGeo, beamMat);
    scanBeam.position.set(0, 0, 0.56);
    group.add(scanBeam);

    this.scene.add(group);

    this.enemies.push({
      id: `drone_${idx}`,
      type: 'drone',
      group,
      rotors,
      eyeMat,
      beamMat,
      origin: new THREE.Vector3(cfg.x, cfg.y, cfg.z),
      patrolRadius: cfg.patrolRadius,
      leashRadius: cfg.leashRadius || 25,
      speed: cfg.speed,
      phase: idx * 1.5,
      hp: 60,
      maxHp: 60,
      state: 'SCANNING',
      lockTimer: 0,
      fireCooldown: 0
    });
  }

  createLaserCamera(cfg, idx) {
    const group = new THREE.Group();
    group.position.set(cfg.x, cfg.y, cfg.z);

    const mountMat = new THREE.MeshStandardMaterial({ map: this.textures.metalMap, color: 0x37464F, metalness: 0.7 });
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), mountMat);
    group.add(mount);

    const head = new THREE.Group();
    const camBodyMat = new THREE.MeshStandardMaterial({ color: 0xE6ECF2, roughness: 0.32, metalness: 0.35 });
    const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.70), camBodyMat);
    camBody.position.set(0, 0, 0.25);
    camBody.castShadow = true;
    camBody.userData.enemyId = `cam_${idx}`;
    head.add(camBody);
    this.shootableMeshes.push(camBody);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xFFC800 });
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16), eyeMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 0.62);
    lens.userData.enemyId = `cam_${idx}`;
    head.add(lens);
    this.shootableMeshes.push(lens);

    const beamGeo = new THREE.CylinderGeometry(0.03, 0.4, 18, 12, 1, true);
    beamGeo.translate(0, -9, 0);
    beamGeo.rotateX(-Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xFFC800,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const scanBeam = new THREE.Mesh(beamGeo, beamMat);
    scanBeam.position.set(0, 0, 0.63);
    head.add(scanBeam);

    group.add(head);
    this.scene.add(group);

    this.enemies.push({
      id: `cam_${idx}`,
      type: 'camera',
      group,
      head,
      eyeMat,
      beamMat,
      baseYaw: cfg.baseYaw,
      phase: idx * 1.2,
      hp: 36,
      maxHp: 36,
      state: 'SCANNING',
      lockTimer: 0,
      fireCooldown: 0
    });
  }

  setScoped(scoped) {
    if (this.player.isScoped === scoped || this.isGameOver || this.isVictory) return;
    this.player.isScoped = scoped;
    soundEngine.playScopeToggle(scoped);
    this.syncHud();
  }

  toggleScoped() {
    this.setScoped(!this.player.isScoped);
  }

  toggleCover() {
    if (this.isGameOver || this.isVictory) return;
    this.player.inCover = !this.player.inCover;
    soundEngine.playCoverToggle(this.player.inCover);
    this.syncHud();
  }

  setCover(inCover) {
    if (this.player.inCover === inCover) return;
    this.player.inCover = inCover;
    soundEngine.playCoverToggle(inCover);
    this.syncHud();
  }

  fireWeapon() {
    if (!this.isRunning || this.isGameOver || this.isVictory) return;
    if (this.player.reloading) return;

    const now = performance.now();
    if (now - this.player.lastShotTime < this.activeWeapon.computedFireRateMs) {
      return;
    }

    if (this.player.ammo <= 0) {
      this.reloadWeapon();
      return;
    }

    this.player.lastShotTime = now;

    if (this.player.inCover) {
      this.player.currentEyeHeight = this.standingEyeHeight - 0.10;
      this.camera.position.y = this.player.currentEyeHeight;
    }

    this.player.ammo -= 1;
    this.weaponRecoil = this.player.isScoped ? 0.05 : 0.11;
    this.muzzleFlashTimer = 0.05;
    this.muzzleFlash.material.opacity = 1;
    this.muzzleFlash.rotation.z = Math.random() * Math.PI;
    soundEngine.playPlayerFire(this.activeWeapon.id);

    this.spawnShellCasing();

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const muzzleWorld = new THREE.Vector3();
    this.muzzleFlash.getWorldPosition(muzzleWorld);

    const blockerMeshes = this.blockers.map((b) => b.mesh);
    const wallHits = raycaster.intersectObjects(blockerMeshes, false);
    const maxDist = wallHits.length > 0 ? wallHits[0].distance : 180;

    const targetHits = raycaster.intersectObjects(this.shootableMeshes, false);
    let hitPoint = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, maxDist);
    let hitTarget = false;

    if (targetHits.length > 0 && targetHits[0].distance <= maxDist) {
      hitPoint = targetHits[0].point;
      hitTarget = true;
      const hitObj = targetHits[0].object;
      const dmg = Math.round(this.activeWeapon.damage * (this.player.isScoped ? 1.3 : 1.0));

      if (hitObj.userData.enemyId) {
        this.damageEnemy(hitObj.userData.enemyId, dmg, hitPoint);
      } else if (hitObj.userData.switchId) {
        this.damageMainSwitch(hitObj.userData.switchId, dmg);
      }
    }

    this.spawnTracer(muzzleWorld, hitPoint, this.activeWeapon.color);
    this.spawnImpactParticles(hitPoint, hitTarget ? 0xFF4B4B : 0xFFE66D, hitTarget ? 12 : 6);
    this.syncHud();
  }

  damageMainSwitch(switchId, dmg) {
    const sw = this.mainSwitches.find((s) => s.id === switchId);
    if (!sw || sw.destroyed) return;

    sw.hp -= dmg;
    if (sw.hp <= 0) {
      sw.destroyed = true;
      soundEngine.playSwitchExplosion();

      const pos = sw.group.position.clone().add(new THREE.Vector3(0, 2, 0));
      this.spawnImpactParticles(pos, 0xFF4B4B, 36);
      this.spawnImpactParticles(pos, 0xFFC800, 28);

      this.scene.remove(sw.group);
      this.shootableMeshes = this.shootableMeshes.filter((m) => m.userData.switchId !== switchId);

      this.player.ammo = this.player.maxAmmo;
      this.player.reserveAmmo += sw.ammoReward;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 45);
      this.player.score += 500;
      this.callbacks.onRewardEarned?.({
        coins: sw.coinReward,
        ammo: sw.ammoReward,
        label: `${sw.name} DESTROYED!`
      });

      this.checkMissionVictory();
    } else {
      soundEngine.playUiClick(820);
    }
  }

  spawnShellCasing() {
    const geo = new THREE.CylinderGeometry(0.008, 0.008, 0.032, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xFFC800, metalness: 0.85, roughness: 0.25 });
    const shell = new THREE.Mesh(geo, mat);
    const worldPos = new THREE.Vector3();
    this.weaponGroup.getWorldPosition(worldPos);
    shell.position.copy(worldPos);

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const vel = right.multiplyScalar(2.4 + Math.random()).add(up.multiplyScalar(1.8));
    this.scene.add(shell);
    this.shellCasings.push({ mesh: shell, vel, life: 0.65 });
  }

  reloadWeapon() {
    if (this.player.reloading || this.player.ammo === this.player.maxAmmo) return;
    if (this.player.reserveAmmo <= 0) return;

    this.player.reloading = true;
    this.setScoped(false);
    soundEngine.playReload();
    this.syncHud();

    setTimeout(() => {
      const needed = this.player.maxAmmo - this.player.ammo;
      const load = Math.min(needed, this.player.reserveAmmo);
      this.player.ammo += load;
      this.player.reserveAmmo -= load;
      this.player.reloading = false;
      this.syncHud();
    }, this.activeWeapon.computedReloadMs);
  }

  jump() {
    if (this.player.onGround && !this.isGameOver && !this.isVictory) {
      if (this.player.inCover) this.setCover(false);
      this.player.vel.y = 7.8;
      this.player.onGround = false;
      soundEngine.playUiClick(440);
    }
  }

  damageEnemy(enemyId, dmg, hitPoint) {
    const idx = this.enemies.findIndex((e) => e.id === enemyId);
    if (idx === -1) return;
    const enemy = this.enemies[idx];
    enemy.hp -= dmg;

    // Only alert the single enemy you shot (not the whole map!)
    enemy.state = 'LOCKED';
    enemy.lockTimer = 0.25;

    if (enemy.hp <= 0) {
      soundEngine.playEnemyDestroy();
      this.spawnImpactParticles(hitPoint, 0xFFC800, 24);

      this.scene.remove(enemy.group);
      this.shootableMeshes = this.shootableMeshes.filter((m) => m.userData.enemyId !== enemyId);
      this.enemies.splice(idx, 1);

      const coinGain = enemy.type === 'drone' ? 90 : 60;
      const ammoGain = 14;
      this.player.reserveAmmo += ammoGain;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 15);
      this.player.score += enemy.type === 'drone' ? 250 : 150;

      this.callbacks.onRewardEarned?.({
        coins: coinGain,
        ammo: ammoGain,
        label: enemy.type === 'drone' ? 'DRONE DESTROYED' : 'LASER CAM DESTROYED'
      });

      this.checkMissionVictory();
    } else {
      soundEngine.playUiClick(740);
    }
  }

  checkMissionVictory() {
    const switchesRemaining = this.mainSwitches.filter((s) => !s.destroyed).length;
    if (this.enemies.length === 0 && switchesRemaining === 0) {
      this.isVictory = true;
      this.setScoped(false);
      this.callbacks.onGameEnd?.({ victory: true, score: this.player.score });
    }
  }

  spawnTracer(start, end, color) {
    const dist = start.distanceTo(end);
    if (dist < 0.2) return;
    const geo = new THREE.CylinderGeometry(0.02, 0.02, dist, 6);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start).lerp(end, 0.5);
    mesh.lookAt(end);
    this.scene.add(mesh);

    this.projectiles.push({ mesh, life: 0.09, maxLife: 0.09 });
  }

  spawnImpactParticles(pos, color, count) {
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 11,
        Math.random() * 7 + 1.5,
        (Math.random() - 0.5) * 11
      );
      this.scene.add(p);
      this.particles.push({ mesh: p, vel, life: 0.55 });
    }
  }

  isProtectedByLowCover(enemyPos) {
    if (!this.player.inCover || this.player.currentEyeHeight > 1.32) return false;

    for (const b of this.blockers) {
      if (b.height >= 1.3 && b.height <= 2.2) {
        const cx = (b.minX + b.maxX) * 0.5;
        const cz = (b.minZ + b.maxZ) * 0.5;
        const distToCover = Math.hypot(this.player.pos.x - cx, this.player.pos.z - cz);
        if (distToCover < 4.5) {
          const distEnemyToPlayer = Math.hypot(this.player.pos.x - enemyPos.x, this.player.pos.z - enemyPos.z);
          const distEnemyToCover = Math.hypot(cx - enemyPos.x, cz - enemyPos.z);
          if (distEnemyToCover < distEnemyToPlayer) {
            return true;
          }
        }
      }
    }
    return false;
  }

  getCurrentZoneName() {
    const { x, z } = this.player.pos;
    if (z < -42 && Math.abs(x) < 42) return 'ANCIENT CITADEL FORT';
    if (x < -38) return 'HARBOR CONTAINER PORT';
    if (x > 40) return 'REMOTE MOUNTAIN OUTPOST';
    return 'CENTRAL CROSSROADS';
  }

  updatePlayer(dt, now) {
    if (this.player.spawnProtectionTimer > 0) {
      this.player.spawnProtectionTimer = Math.max(0, this.player.spawnProtectionTimer - dt);
    }

    // Passive tactical shield/health regeneration when out of combat for 4 seconds
    if (now - this.player.lastDamageTime > 4000 && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + dt * 9);
    }

    let forwardInput = 0;
    let rightInput = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) forwardInput += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forwardInput -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) rightInput += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) rightInput -= 1;

    forwardInput += this.touchMove.y;
    rightInput += this.touchMove.x;

    const inputLen = Math.hypot(forwardInput, rightInput);
    if (inputLen > 1) {
      forwardInput /= inputLen;
      rightInput /= inputLen;
    }

    let moveSpeed = 12.2;
    if (this.player.inCover) moveSpeed = 6.8;
    else if (this.player.isScoped) moveSpeed = 8.2;

    const sinYaw = Math.sin(this.player.yaw);
    const cosYaw = Math.cos(this.player.yaw);

    const moveX = (-sinYaw * forwardInput + cosYaw * rightInput) * moveSpeed;
    const moveZ = (-cosYaw * forwardInput - sinYaw * rightInput) * moveSpeed;

    let nextX = this.player.pos.x + moveX * dt;
    let nextZ = this.player.pos.z + moveZ * dt;

    if (this.wasmPhysics) {
      const resolved = this.wasmPhysics.resolvePlayerCollision(nextX, nextZ, 0.65);
      nextX = resolved.x;
      nextZ = resolved.z;
    }

    this.player.pos.x = nextX;
    this.player.pos.z = nextZ;

    const targetEye = this.player.inCover ? this.crouchEyeHeight : this.standingEyeHeight;
    this.player.currentEyeHeight = THREE.MathUtils.lerp(this.player.currentEyeHeight, targetEye, dt * 12);

    this.player.vel.y -= 21.0 * dt;
    this.player.pos.y += this.player.vel.y * dt;
    if (this.player.pos.y <= this.player.currentEyeHeight) {
      this.player.pos.y = this.player.currentEyeHeight;
      this.player.vel.y = 0;
      this.player.onGround = true;
    }

    this.camera.position.copy(this.player.pos);
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;

    const targetFov = this.player.isScoped ? this.scopeFov : this.baseFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 14);
      this.camera.updateProjectionMatrix();
    }

    // Keep handgun & SMG visible even during reflex/red-dot zoom; only hide weapon on high-zoom Sniper scope!
    const isHighZoomSniper = this.activeWeapon.modelType === 'sniper' && this.player.isScoped;
    this.weaponGroup.visible = !isHighZoomSniper;

    const targetWeaponPos = this.player.isScoped ? this.adsWeaponPos : this.hipWeaponPos;
    this.weaponGroup.position.lerp(targetWeaponPos, dt * 15);

    if (inputLen > 0.05 && this.player.onGround) {
      this.weaponBobTime += dt * 11;
    }
    this.weaponRecoil = THREE.MathUtils.lerp(this.weaponRecoil, 0, dt * 16);
    const bobX = Math.cos(this.weaponBobTime * 0.5) * (this.player.isScoped ? 0.002 : 0.01);
    const bobY = Math.abs(Math.sin(this.weaponBobTime)) * (this.player.isScoped ? 0.002 : 0.012);
    const reloadTilt = this.player.reloading ? -0.45 : 0;

    this.weaponGroup.position.x += bobX;
    this.weaponGroup.position.y -= bobY + (this.player.reloading ? 0.06 : 0);
    this.weaponGroup.position.z += this.weaponRecoil;
    this.weaponGroup.rotation.x = this.weaponRecoil * 1.2 + reloadTilt;

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlash.material.opacity = 0;
      }
    }
  }

  updateEnemiesAndSwitches(dt, elapsed) {
    for (const sw of this.mainSwitches) {
      if (!sw.destroyed) {
        sw.core.rotation.y += dt * 2.2;
        sw.core.position.y = 2.25 + Math.sin(elapsed * 3.5) * 0.14;
        sw.ring.rotation.x = Math.sin(elapsed * 2) * 0.5;
        sw.ring.rotation.y -= dt * 3.0;
      }
    }

    let anyLocked = false;
    let lockedCount = 0;

    for (const enemy of this.enemies) {
      let lookDir = new THREE.Vector3();

      if (enemy.type === 'drone') {
        enemy.rotors?.forEach((r) => {
          r.rotation.y += dt * 28;
        });

        // Drones stay inside their patrol leash and NEVER swarm across the map
        const angle = elapsed * enemy.speed * 0.45 + enemy.phase;
        enemy.group.position.x = enemy.origin.x + Math.cos(angle) * enemy.patrolRadius;
        enemy.group.position.z = enemy.origin.z + Math.sin(angle) * enemy.patrolRadius;
        enemy.group.position.y = enemy.origin.y + Math.sin(elapsed * 2.8 + enemy.phase) * 0.22;

        if (enemy.state === 'SCANNING') {
          enemy.group.rotation.y = elapsed * 1.05 + enemy.phase;
        } else {
          const dx = this.player.pos.x - enemy.group.position.x;
          const dz = this.player.pos.z - enemy.group.position.z;
          enemy.group.rotation.y = Math.atan2(dx, dz);
        }
        enemy.group.getWorldDirection(lookDir);
      } else {
        if (enemy.state === 'SCANNING') {
          enemy.head.rotation.y = enemy.baseYaw + Math.sin(elapsed * 1.05 + enemy.phase) * 0.95;
        } else {
          const dx = this.player.pos.x - enemy.group.position.x;
          const dz = this.player.pos.z - enemy.group.position.z;
          enemy.head.rotation.y = Math.atan2(dx, dz);
        }
        enemy.head.getWorldDirection(lookDir);
      }

      const enemyWorldPos = new THREE.Vector3();
      enemy.group.getWorldPosition(enemyWorldPos);

      const toPlayer = new THREE.Vector3().subVectors(this.player.pos, enemyWorldPos);
      const distToPlayer = toPlayer.length();
      const toPlayerFlat = new THREE.Vector3(toPlayer.x, 0, toPlayer.z).normalize();
      const lookDirFlat = new THREE.Vector3(lookDir.x, 0, lookDir.z).normalize();

      // Narrower detection cone (20m range, ~32 deg cone) so you can easily sneak, walk around, and ambush!
      const dot = lookDirFlat.dot(toPlayerFlat);
      const maxDetectRange = enemy.type === 'drone' ? 21 : 19;
      const inCone = distToPlayer < maxDetectRange && dot > 0.87;

      let blockedByWall = false;
      if (inCone && this.wasmPhysics) {
        blockedByWall = this.wasmPhysics.isLineOfSightBlocked(
          enemyWorldPos.x,
          enemyWorldPos.z,
          this.player.pos.x,
          this.player.pos.z
        );
      }

      const hiddenInLowCover = inCone && this.isProtectedByLowCover(enemyWorldPos);
      const isSafe = this.player.spawnProtectionTimer > 0;

      // Cap simultaneous attackers to at most 1-2 enemies at once so you never get unfairly instakilled
      if (inCone && !blockedByWall && !hiddenInLowCover && !isSafe && lockedCount < 2) {
        lockedCount++;
        if (enemy.state !== 'LOCKED') {
          enemy.state = 'LOCKED';
          soundEngine.playAlertBeep();
        }
        anyLocked = true;
        enemy.lockTimer += dt;

        enemy.eyeMat.color.setHex(0xFF4B4B);
        enemy.beamMat.color.setHex(0xFF4B4B);
        enemy.beamMat.opacity = 0.42;

        // 1.15-second lock-on telegraph gives you plenty of time to press C (Cover) or dash behind a wall!
        enemy.fireCooldown -= dt;
        if (enemy.lockTimer > 1.15 && enemy.fireCooldown <= 0) {
          enemy.fireCooldown = enemy.type === 'drone' ? 1.55 : 1.75;
          this.enemyShootPlayer(enemyWorldPos);
        }
      } else {
        enemy.state = 'SCANNING';
        enemy.lockTimer = 0;
        const idleHex = enemy.type === 'drone' ? 0x1CB0F6 : 0xFFC800;
        enemy.eyeMat.color.setHex(idleHex);
        enemy.beamMat.color.setHex(idleHex);
        enemy.beamMat.opacity = 0.22;
      }
    }

    this.callbacks.onAlertChange?.(anyLocked);
  }

  enemyShootPlayer(originPos) {
    if (this.isGameOver || this.isVictory) return;
    soundEngine.playEnemyLaser();

    const targetPos = this.player.pos.clone().add(new THREE.Vector3(0, -0.25, 0));
    this.spawnTracer(originPos, targetPos, 0xFF4B4B);

    // Balanced 7 DMG per laser hit (out of 150 HP = ~22 hits to kill, never an instant death!)
    this.player.hp = Math.max(0, this.player.hp - 7);
    this.player.lastDamageTime = performance.now();
    soundEngine.playPlayerHit();
    this.callbacks.onPlayerDamaged?.();
    this.syncHud();

    if (this.player.hp <= 0) {
      this.isGameOver = true;
      this.setScoped(false);
      this.callbacks.onGameEnd?.({ victory: false, score: this.player.score });
    }
  }

  updateEffects(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      } else {
        p.mesh.material.opacity = p.life / p.maxLife;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.vel.y -= 15 * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.shellCasings.length - 1; i >= 0; i--) {
      const s = this.shellCasings[i];
      s.life -= dt;
      s.vel.y -= 9.8 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += dt * 18;
      s.mesh.rotation.z += dt * 14;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        this.shellCasings.splice(i, 1);
      }
    }
  }

  syncHud() {
    const dronesLeft = this.enemies.filter((e) => e.type === 'drone').length;
    const camerasLeft = this.enemies.filter((e) => e.type === 'camera').length;
    const switchesLeft = this.mainSwitches.filter((s) => !s.destroyed).length;

    this.callbacks.onHudUpdate?.({
      hp: Math.round(this.player.hp),
      maxHp: this.player.maxHp,
      ammo: this.player.ammo,
      maxAmmo: this.player.maxAmmo,
      reserveAmmo: this.player.reserveAmmo,
      reloading: this.player.reloading,
      inCover: this.player.inCover,
      isScoped: this.player.isScoped,
      isSniperScope: this.activeWeapon.modelType === 'sniper' && this.player.isScoped,
      score: this.player.score,
      zoneName: this.getCurrentZoneName(),
      weaponName: this.activeWeapon.name,
      dronesLeft,
      camerasLeft,
      switchesLeft,
      fps: this.fpsCounter.value
    });
  }

  loop = (now) => {
    if (!this.isRunning || this.disposed) return;
    requestAnimationFrame(this.loop);

    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    const elapsed = now / 1000;

    this.fpsCounter.frames++;
    if (now - this.fpsCounter.lastCheck >= 350) {
      this.fpsCounter.value = Math.round((this.fpsCounter.frames * 1000) / (now - this.fpsCounter.lastCheck));
      this.fpsCounter.frames = 0;
      this.fpsCounter.lastCheck = now;
      this.syncHud();
    }

    if (!this.isGameOver && !this.isVictory) {
      this.updatePlayer(dt, now);
      this.updateEnemiesAndSwitches(dt, elapsed);
    }
    this.updateEffects(dt);

    this.renderer.render(this.scene, this.camera);
  };

  handleResize = () => {
    if (!this.container || !this.renderer) return;
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  dispose() {
    this.disposed = true;
    this.isRunning = false;
    window.removeEventListener('resize', this.handleResize);
    if (this.renderer && this.renderer.domElement && this.container?.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
    this.renderer?.dispose?.();
  }
}
