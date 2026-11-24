import React, { useState } from 'react';
import { Monitor, Smartphone, Play, ShoppingBag, Coins, MapPin, Crosshair, Check } from 'lucide-react';
import { WEAPONS, DEPLOY_LOCATIONS } from '../engine/arsenalData';
import { soundEngine } from '../engine/soundEngine';

export default function MainMenu({
  coins,
  loadout,
  selectedLocationId,
  onSelectLocation,
  onEquipWeapon,
  onStartGame,
  onOpenArmory
}) {
  const defaultDevice = typeof window !== 'undefined' && window.innerWidth < 860 ? 'phone' : 'pc';
  const [selectedDevice, setSelectedDevice] = useState(defaultDevice);

  const unlockedWeapons = WEAPONS.filter((w) => loadout.unlockedWeapons.includes(w.id));

  const handleSelectDevice = (device) => {
    soundEngine.playUiClick(device === 'pc' ? 520 : 620);
    setSelectedDevice(device);
  };

  const handlePlay = async () => {
    soundEngine.playUiClick(720);

    if (selectedDevice === 'phone') {
      try {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen && !document.fullscreenElement) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch (err) {
        console.info('Fullscreen/Landscape request handled:', err?.message || err);
      }
    }

    onStartGame(selectedDevice);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#131F24] p-3 sm:p-5 overflow-y-auto">
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#58CC02 2px, transparent 2px)',
          backgroundSize: '32px 32px'
        }}
      />

      <div className="relative z-10 w-full max-w-4xl duo-card p-5 sm:p-7 flex flex-col gap-5 max-h-[95vh] overflow-y-auto">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#37464F] pb-3.5">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              DUO <span className="text-[#58CC02]">STRIKE</span> 3D
            </h1>
            <p className="text-xs font-bold text-[#8FA3AD]">
              Choose your starter weapon, deployment location &amp; controls
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-2xl bg-[#182429] border border-[#FFC800] flex items-center gap-2">
              <Coins size={18} className="text-[#FFC800]" />
              <span className="text-sm font-black text-[#FFC800]">{coins}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(640);
                onOpenArmory();
              }}
              className="duo-btn duo-btn-purple px-3.5 py-2 text-xs"
            >
              <ShoppingBag size={15} /> FULL ARMORY
            </button>
          </div>
        </div>

        {/* 1. DEPLOYMENT LOCATION SELECTOR */}
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[#778A94] mb-2 flex items-center gap-1.5">
            <MapPin size={14} className="text-[#58CC02]" /> 1. Select Deployment Location
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {DEPLOY_LOCATIONS.map((loc) => {
              const selected = selectedLocationId === loc.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick(580);
                    onSelectLocation(loc.id);
                  }}
                  className={`duo-card duo-card-selectable p-3 text-left flex flex-col justify-between gap-1.5 ${
                    selected ? 'duo-card-selected' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="px-2 py-0.5 rounded-md text-[9px] font-black text-[#131F24]"
                      style={{ backgroundColor: loc.accent }}
                    >
                      {loc.badge}
                    </span>
                    {selected && <Check size={15} className="text-[#1CB0F6]" />}
                  </div>
                  <div className="text-sm font-black text-white leading-tight">{loc.name}</div>
                  <div className="text-[11px] font-bold text-[#8FA3AD] leading-snug">
                    {loc.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. STARTER / UNLOCKED WEAPON SELECTOR */}
        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[#778A94] mb-2 flex items-center gap-1.5">
            <Crosshair size={14} className="text-[#1CB0F6]" /> 2. Select Starting Weapon (Glock Handgun or SMG)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {unlockedWeapons.map((w) => {
              const equipped = loadout.equippedWeaponId === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick(640);
                    onEquipWeapon(w.id);
                  }}
                  className={`duo-card duo-card-selectable p-3.5 text-left flex items-center justify-between gap-3 ${
                    equipped ? 'duo-card-selected' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm sm:text-base font-black text-white">{w.name}</span>
                      <span className="px-2 py-0.5 rounded-md bg-[#131F24] text-[10px] font-black text-[#58CC02]">
                        {w.badge}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#8FA3AD]">{w.description}</p>
                  </div>

                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      equipped ? 'bg-[#1CB0F6] text-white' : 'bg-[#2B3E47] text-[#778A94]'
                    }`}
                  >
                    <Check size={18} strokeWidth={3} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. DEVICE CONTROLS & DEPLOY */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch pt-1">
          <button
            type="button"
            onClick={() => handleSelectDevice('pc')}
            className={`duo-card duo-card-selectable p-3.5 flex items-center gap-3 ${
              selectedDevice === 'pc' ? 'duo-card-selected' : ''
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                selectedDevice === 'pc' ? 'bg-[#1CB0F6] text-white' : 'bg-[#2B3E47] text-[#AFAFAF]'
              }`}
            >
              <Monitor size={24} strokeWidth={2.5} />
            </div>
            <div className="text-left">
              <div className="text-sm font-black text-white">PC CONTROLS</div>
              <div className="text-[11px] font-bold text-[#8FA3AD]">WASD • RMB Aim • C Cover</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectDevice('phone')}
            className={`duo-card duo-card-selectable p-3.5 flex items-center gap-3 ${
              selectedDevice === 'phone' ? 'duo-card-selected' : ''
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                selectedDevice === 'phone' ? 'bg-[#1CB0F6] text-white' : 'bg-[#2B3E47] text-[#AFAFAF]'
              }`}
            >
              <Smartphone size={24} strokeWidth={2.5} />
            </div>
            <div className="text-left">
              <div className="text-sm font-black text-white">PHONE LANDSCAPE</div>
              <div className="text-[11px] font-bold text-[#8FA3AD]">Auto-Landscape • Touch Pad</div>
            </div>
          </button>

          <button
            type="button"
            onClick={handlePlay}
            className="duo-btn duo-btn-green py-4 text-lg"
          >
            <Play size={22} fill="currentColor" />
            DEPLOY NOW
          </button>
        </div>
      </div>
    </div>
  );
}
