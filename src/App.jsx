import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Skull, RotateCcw, ShoppingBag } from 'lucide-react';
import { GameEngine } from './engine/GameEngine';
import { soundEngine } from './engine/soundEngine';
import MainMenu from './components/MainMenu';
import GameHud from './components/GameHud';
import TouchControls from './components/TouchControls';
import ArmoryModal from './components/ArmoryModal';

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [deviceMode, setDeviceMode] = useState('pc');
  const [selectedLocationId, setSelectedLocationId] = useState('crossroads');
  const [gameSessionId, setGameSessionId] = useState(0);
  const [showArmory, setShowArmory] = useState(false);

  const [coins, setCoins] = useState(350);
  const [loadout, setLoadout] = useState({
    // Both Glock-18 Handgun and Viper MP5 SMG are unlocked right from the start!
    unlockedWeapons: ['glock', 'smg'],
    equippedWeaponId: 'glock',
    upgrades: {
      fireRate: 1,
      magSize: 1,
      reloadSpeed: 1
    }
  });

  const canvasContainerRef = useRef(null);
  const engineRef = useRef(null);

  const [hud, setHud] = useState({
    hp: 150,
    maxHp: 150,
    ammo: 17,
    maxAmmo: 17,
    reserveAmmo: 120,
    reloading: false,
    inCover: false,
    isScoped: false,
    isSniperScope: false,
    score: 0,
    zoneName: 'CENTRAL CROSSROADS',
    weaponName: 'Glock-18 Tactical Pistol',
    dronesLeft: 5,
    camerasLeft: 6,
    switchesLeft: 3,
    fps: 60
  });

  const [rewardToast, setRewardToast] = useState(null);
  const [isLockedOn, setIsLockedOn] = useState(false);
  const [damageFlash, setDamageFlash] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [endResult, setEndResult] = useState(null);

  const startGame = (selectedDevice) => {
    setDeviceMode(selectedDevice);
    setEndResult(null);
    setIsLockedOn(false);
    setShowArmory(false);
    setGameSessionId((prev) => prev + 1);
    setScreen('playing');
  };

  useEffect(() => {
    if (screen !== 'playing' || !canvasContainerRef.current) return;

    const engine = new GameEngine(
      canvasContainerRef.current,
      {
        onHudUpdate: (data) => setHud(data),
        onAlertChange: (locked) => setIsLockedOn(locked),
        onRewardEarned: ({ coins: earnedCoins, ammo, label }) => {
          setCoins((c) => c + earnedCoins);
          setRewardToast({ coins: earnedCoins, ammo, label });
          setTimeout(() => setRewardToast(null), 2600);
        },
        onPlayerDamaged: () => {
          setDamageFlash(true);
          setTimeout(() => setDamageFlash(false), 180);
        },
        onGameEnd: (result) => {
          setEndResult(result);
          if (document.pointerLockElement) {
            document.exitPointerLock?.();
          }
        }
      },
      loadout,
      selectedLocationId
    );

    engineRef.current = engine;
    engine.init();

    const onKeyDown = (e) => {
      if (showArmory) return;
      engine.keys[e.code] = true;
      if (e.code === 'Space') engine.jump();
      if (e.code === 'KeyR') engine.reloadWeapon();
      if (e.code === 'KeyC' || e.code === 'ShiftLeft') engine.toggleCover();
      if (e.code === 'KeyB') {
        if (document.pointerLockElement) document.exitPointerLock?.();
        setShowArmory(true);
      }
    };

    const onKeyUp = (e) => {
      engine.keys[e.code] = false;
    };

    const onMouseMove = (e) => {
      if (document.pointerLockElement === canvasContainerRef.current) {
        const sens = engine.player.isScoped ? 0.0013 : 0.0022;
        engine.player.yaw -= e.movementX * sens;
        engine.player.pitch = Math.max(
          -Math.PI / 2.3,
          Math.min(Math.PI / 2.3, engine.player.pitch - e.movementY * sens)
        );
      }
    };

    const onMouseDown = (e) => {
      if (deviceMode !== 'pc' || showArmory) return;
      if (e.button === 0) {
        if (document.pointerLockElement !== canvasContainerRef.current) {
          canvasContainerRef.current?.requestPointerLock?.();
        } else {
          engine.fireWeapon();
        }
      } else if (e.button === 2) {
        if (document.pointerLockElement === canvasContainerRef.current) {
          engine.setScoped(true);
        }
      }
    };

    const onMouseUp = (e) => {
      if (deviceMode === 'pc' && e.button === 2) {
        engine.setScoped(false);
      }
    };

    const onContextMenu = (e) => e.preventDefault();

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvasContainerRef.current;
      setIsPointerLocked(locked);
      if (!locked) {
        engine.setScoped(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    if (deviceMode === 'pc') {
      canvasContainerRef.current?.requestPointerLock?.();
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      engine.dispose();
      engineRef.current = null;
    };
  }, [screen, gameSessionId, deviceMode, loadout, selectedLocationId]);

  const handlePurchaseWeapon = (weapon) => {
    if (coins < weapon.cost || loadout.unlockedWeapons.includes(weapon.id)) return;
    setCoins((c) => c - weapon.cost);
    setLoadout((prev) => ({
      ...prev,
      unlockedWeapons: [...prev.unlockedWeapons, weapon.id],
      equippedWeaponId: weapon.id
    }));
  };

  const handleEquipWeapon = (weaponId) => {
    setLoadout((prev) => ({
      ...prev,
      equippedWeaponId: weaponId
    }));
  };

  const handleUpgradeStat = (statId, cost) => {
    if (coins < cost) return;
    setCoins((c) => c - cost);
    setLoadout((prev) => ({
      ...prev,
      upgrades: {
        ...prev.upgrades,
        [statId]: prev.upgrades[statId] + 1
      }
    }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#131F24]">
      {screen === 'menu' && (
        <MainMenu
          coins={coins}
          loadout={loadout}
          selectedLocationId={selectedLocationId}
          onSelectLocation={setSelectedLocationId}
          onEquipWeapon={handleEquipWeapon}
          onStartGame={startGame}
          onOpenArmory={() => setShowArmory(true)}
        />
      )}

      {screen === 'playing' && (
        <>
          <div
            ref={canvasContainerRef}
            style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 1 }}
            className="cursor-crosshair"
          />

          <GameHud
            hud={hud}
            coins={coins}
            rewardToast={rewardToast}
            deviceMode={deviceMode}
            isLockedOn={isLockedOn}
            damageFlash={damageFlash}
            isPointerLocked={isPointerLocked}
            onRequestPointerLock={() => {
              soundEngine.playUiClick(580);
              canvasContainerRef.current?.requestPointerLock?.();
            }}
            onOpenArmory={() => {
              if (document.pointerLockElement) document.exitPointerLock?.();
              setShowArmory(true);
            }}
            onReturnMenu={() => {
              if (document.pointerLockElement) document.exitPointerLock?.();
              setScreen('menu');
            }}
          />

          {deviceMode === 'phone' && !endResult && !showArmory && (
            <TouchControls
              inCover={hud.inCover}
              isScoped={hud.isScoped}
              onMoveChange={(vec) => {
                if (engineRef.current) engineRef.current.touchMove = vec;
              }}
              onLookDelta={(dyaw, dpitch) => {
                if (engineRef.current) {
                  engineRef.current.player.yaw -= dyaw;
                  engineRef.current.player.pitch = Math.max(
                    -Math.PI / 2.3,
                    Math.min(Math.PI / 2.3, engineRef.current.player.pitch - dpitch)
                  );
                }
              }}
              onFire={() => engineRef.current?.fireWeapon()}
              onToggleScope={() => engineRef.current?.toggleScoped()}
              onToggleCover={() => engineRef.current?.toggleCover()}
              onJump={() => engineRef.current?.jump()}
              onReload={() => engineRef.current?.reloadWeapon()}
            />
          )}

          {endResult && (
            <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#131F24]/85 backdrop-blur-sm p-4">
              <div className="duo-card max-w-md w-full p-8 text-center flex flex-col items-center">
                <div
                  className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 ${
                    endResult.victory ? 'bg-[#58CC02] text-white' : 'bg-[#FF4B4B] text-white'
                  }`}
                >
                  {endResult.victory ? <Trophy size={42} /> : <Skull size={42} />}
                </div>

                <h2 className="text-3xl font-black text-white mb-2">
                  {endResult.victory ? 'SECTOR LIBERATED!' : 'AGENT DOWN'}
                </h2>
                <p className="text-[#AFAFAF] font-bold mb-6">
                  {endResult.victory
                    ? 'All 3 Main Reactor Switches & enemy defenses destroyed!'
                    : 'Use C (Cover) behind low walls when enemies lock on, or switch weapons in the Armory!'}
                </p>

                <div className="grid grid-cols-3 gap-2 w-full mb-3">
                  <button
                    type="button"
                    onClick={() => setShowArmory(true)}
                    className="duo-btn duo-btn-purple py-3.5 text-xs"
                  >
                    <ShoppingBag size={16} /> WEAPONS
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreen('menu')}
                    className="duo-btn duo-btn-blue py-3.5 text-xs"
                  >
                    LOCATION
                  </button>
                  <button
                    type="button"
                    onClick={() => startGame(deviceMode)}
                    className="duo-btn duo-btn-green py-3.5 text-xs"
                  >
                    <RotateCcw size={16} /> REPLAY
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showArmory && (
        <ArmoryModal
          coins={coins}
          loadout={loadout}
          onPurchaseWeapon={handlePurchaseWeapon}
          onEquipWeapon={handleEquipWeapon}
          onUpgradeStat={handleUpgradeStat}
          onClose={() => setShowArmory(false)}
        />
      )}
    </div>
  );
}
