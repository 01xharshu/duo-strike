export const WEAPONS = [
  {
    id: 'glock',
    name: 'Glock-18 Tactical Pistol',
    category: 'HANDGUN',
    badge: 'STARTER SIDEARM',
    cost: 0,
    damage: 28,
    fireRateMs: 175,
    baseMag: 17,
    baseReloadMs: 750,
    scopeZoomFov: 52, // Clean iron-sight / reflex aim (1.35x)
    modelType: 'pistol',
    color: 0x58CC02,
    description: 'Lightweight 9mm tactical handgun. Fast draw, crisp reflex sights, and nimble movement.'
  },
  {
    id: 'smg',
    name: 'Viper MP5 Rapid SMG',
    category: 'SMG',
    badge: 'STARTER SMG',
    cost: 0,
    damage: 24,
    fireRateMs: 95,
    baseMag: 32,
    baseReloadMs: 900,
    scopeZoomFov: 46, // Holographic red-dot zoom (1.55x)
    modelType: 'smg',
    color: 0x1CB0F6,
    description: 'Compact submachine gun with rapid cyclic fire and red-dot sight for close-quarters.'
  },
  {
    id: 'carbine',
    name: 'Vanguard M4 Carbine',
    category: 'ASSAULT',
    badge: 'UNLOCKABLE',
    cost: 450,
    damage: 38,
    fireRateMs: 165,
    baseMag: 28,
    baseReloadMs: 1050,
    scopeZoomFov: 36, // 2.0x tactical optic
    modelType: 'rifle',
    color: 0xCE82FF,
    description: 'Versatile mid-range assault carbine with 2.0x tactical optic.'
  },
  {
    id: 'sniper',
    name: 'Titan Long-Range Sniper',
    category: 'SNIPER',
    badge: 'HIGH CALIBER',
    cost: 1100,
    damage: 85,
    fireRateMs: 420,
    baseMag: 10,
    baseReloadMs: 1350,
    scopeZoomFov: 24, // 3.0x sniper scope
    modelType: 'sniper',
    color: 0xFFC800,
    description: 'Precision heavy rifle with 3.0x sniper scope to destroy Reactor Switches from afar.'
  }
];

export const DEPLOY_LOCATIONS = [
  {
    id: 'crossroads',
    name: 'Central Crossroads',
    subtitle: 'Safe Safe-Zone • Lots of Cover Walls',
    badge: 'SAFE START',
    x: 0,
    z: 66,
    yaw: 0,
    accent: '#58CC02',
    description: 'Start in a wide, guarded boulevard with waist-high barricades and plenty of room to plan your approach.'
  },
  {
    id: 'fort',
    name: 'Ancient Citadel Fort',
    subtitle: 'North Sector • Stone Courtyards & Pillars',
    badge: 'NORTH FORT',
    x: -22,
    z: -38,
    yaw: -0.45,
    accent: '#FFC800',
    description: 'Wide sandstone courtyard with massive stone pillars and battlements for stealth flank attacks.'
  },
  {
    id: 'port',
    name: 'Harbor Container Port',
    subtitle: 'West Sector • Cargo Lanes & Pier Cover',
    badge: 'WEST PORT',
    x: -44,
    z: 28,
    yaw: 0.15,
    accent: '#1CB0F6',
    description: 'Sprawling shipyard with wide container alleys and yellow cargo barriers to duck behind.'
  },
  {
    id: 'mountain',
    name: 'Remote Mountain Outpost',
    subtitle: 'East Sector • Alpine Ridge & Boulders',
    badge: 'EAST RIDGE',
    x: 42,
    z: 26,
    yaw: -0.2,
    accent: '#CE82FF',
    description: 'Expansive rocky ridge with natural granite cover and long sightlines to the Mountain Switch.'
  }
];

export const UPGRADE_CONFIG = {
  fireRate: {
    id: 'fireRate',
    label: 'Fire Rate',
    maxLevel: 5,
    baseCost: 200,
    costStep: 150,
    bonusText: '+14% Cyclic Speed / Lvl'
  },
  magSize: {
    id: 'magSize',
    label: 'Ammo Capacity',
    maxLevel: 5,
    baseCost: 180,
    costStep: 140,
    bonusText: '+6 Rounds / Lvl'
  },
  reloadSpeed: {
    id: 'reloadSpeed',
    label: 'Reload Speed',
    maxLevel: 5,
    baseCost: 160,
    costStep: 130,
    bonusText: '-15% Reload Time / Lvl'
  }
};
