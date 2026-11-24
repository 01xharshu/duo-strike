import React from 'react';
import {
  Heart,
  Crosshair,
  Volume2,
  VolumeX,
  RotateCcw,
  ShieldAlert,
  Shield,
  Eye,
  Coins,
  ShoppingBag,
  MapPin,
  Flame
} from 'lucide-react';
import { soundEngine } from '../engine/soundEngine';

export default function GameHud({
  hud,
  coins,
  rewardToast,
  deviceMode,
  isLockedOn,
  damageFlash,
  isPointerLocked,
  onRequestPointerLock,
  onOpenArmory,
  onReturnMenu
}) {
  const [muted, setMuted] = React.useState(false);

  const toggleMute = (e) => {
    e.stopPropagation();
    soundEngine.muted = !muted;
    setMuted(!muted);
    if (!soundEngine.muted) soundEngine.playUiClick(600);
  };

  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Full black sniper vignette ONLY when the Sniper Rifle is equipped and scoped! */}
      {hud.isSniperScope && (
        <div className="fixed inset-0 scope-vignette flex items-center justify-center pointer-events-none">
          <div className="w-[62vmin] h-[62vmin] rounded-full border-4 border-[#1CB0F6]/80 shadow-[0_0_40px_rgba(28,176,246,0.35)] relative flex items-center justify-center">
            <div className="absolute w-full h-[2px] bg-[#58CC02]/70" />
            <div className="absolute h-full w-[2px] bg-[#58CC02]/70" />
            <div className="w-6 h-6 rounded-full border-2 border-[#FF4B4B]" />
            <div className="absolute bottom-5 px-2.5 py-0.5 rounded bg-[#131F24]/80 text-[#1CB0F6] text-[10px] font-black tracking-widest">
              3.0X SNIPER OPTIC
            </div>
          </div>
        </div>
      )}

      {damageFlash && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-150"
          style={{
            background: 'radial-gradient(circle, transparent 50%, rgba(255, 75, 75, 0.45) 100%)'
          }}
        />
      )}

      {/* Top HUD Bar */}
      <div className="flex items-start justify-between p-3 sm:p-5 gap-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="duo-card px-3 py-2 flex items-center gap-2.5">
              <Heart size={20} className="text-[#FF4B4B] fill-[#FF4B4B]" />
              <div className="w-24 sm:w-36 h-3.5 bg-[#131F24] rounded-full overflow-hidden border border-[#37464F]">
                <div
                  className="h-full transition-all duration-150 rounded-full"
                  style={{
                    width: `${hpPct}%`,
                    backgroundColor: hpPct > 35 ? '#58CC02' : '#FF4B4B'
                  }}
                />
              </div>
              <span className="text-xs sm:text-sm font-black text-white">{hud.hp}</span>
            </div>

            <div className="duo-card px-3 py-2 flex items-center gap-1.5 border-[#FFC800]">
              <Coins size={18} className="text-[#FFC800]" />
              <span className="text-xs sm:text-sm font-black text-[#FFC800]">{coins}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black">
            <span className="px-2.5 py-1 rounded-xl bg-[#202F36]/95 border border-[#37464F] text-[#58CC02] flex items-center gap-1">
              <MapPin size={12} /> {hud.zoneName}
            </span>
            {hud.inCover && (
              <span className="px-2.5 py-1 rounded-xl bg-[#FFC800] text-[#131F24] flex items-center gap-1">
                <Shield size={12} /> HIDDEN IN COVER
              </span>
            )}
          </div>
        </div>

        {/* Center Mission Objective Tracker */}
        <div className="flex flex-col items-center gap-2">
          <div className="duo-card px-3.5 py-2 flex items-center gap-3 text-[11px] sm:text-xs font-black">
            <span className="text-[#FF4B4B] flex items-center gap-1">
              <Flame size={14} /> SWITCHES: {hud.switchesLeft}/3
            </span>
            <span className="text-[#37464F]">|</span>
            <span className="text-[#1CB0F6]">DRONES: {hud.dronesLeft}</span>
            <span className="text-[#37464F]">|</span>
            <span className="text-[#FFC800]">CAMS: {hud.camerasLeft}</span>
          </div>

          {rewardToast && (
            <div className="px-4 py-1.5 rounded-2xl bg-[#58CC02] text-white font-black text-xs uppercase tracking-wider shadow-lg">
              {rewardToast.label}: +{rewardToast.coins} COINS &amp; +{rewardToast.ammo} AMMO!
            </div>
          )}

          {isLockedOn && (
            <div className="px-4 py-1.5 rounded-2xl bg-[#FF4B4B] text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg animate-bounce">
              <ShieldAlert size={15} /> LASER LOCKED! DUCK BEHIND COVER (C)!
            </div>
          )}
        </div>

        {/* Top-Right Armory, Audio & Menu */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundEngine.playUiClick(650);
              onOpenArmory();
            }}
            className="duo-btn duo-btn-purple px-3 py-2.5 text-xs"
            title="Switch Weapon / Armory (Key B)"
          >
            <ShoppingBag size={16} />
            <span className="hidden sm:inline">WEAPONS</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="duo-btn duo-btn-blue p-2.5"
            title="Toggle Audio"
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundEngine.playUiClick(450);
              onReturnMenu();
            }}
            className="duo-btn duo-btn-gold px-3 py-2.5 text-xs"
          >
            <RotateCcw size={16} />
            <span className="hidden sm:inline">LOCATION</span>
          </button>
        </div>
      </div>

      {/* Center Precision Crosshair */}
      {!hud.isSniperScope && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center">
            <Crosshair
              size={hud.isScoped ? 22 : 28}
              strokeWidth={2.5}
              className={isLockedOn ? 'text-[#FF4B4B]' : hud.isScoped ? 'text-[#1CB0F6]' : 'text-[#58CC02]'}
            />
            <div className="absolute w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        </div>
      )}

      {deviceMode === 'pc' && !isPointerLocked && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={onRequestPointerLock}
            className="duo-btn duo-btn-green px-6 py-3 text-xs sm:text-sm text-center"
          >
            CLICK TO LOCK AIM • RMB AIM SIGHTS • C HIDE IN COVER • B SWITCH WEAPON
          </button>
        </div>
      )}

      {deviceMode === 'pc' && (
        <div className="fixed bottom-5 left-5 right-5 flex items-end justify-between">
          <div className="duo-card px-4 py-2 text-xs font-extrabold text-[#AFAFAF] flex items-center gap-3">
            <span><strong className="text-white">RMB</strong> Aim</span>
            <span>•</span>
            <span><strong className="text-[#FFC800]">C</strong> Hide / Cover</span>
            <span>•</span>
            <span><strong className="text-[#CE82FF]">B</strong> Switch Weapon</span>
            <span>•</span>
            <span><strong className="text-white">R</strong> Reload</span>
          </div>

          <div className="duo-card px-4 py-2.5 flex items-center gap-3">
            {hud.isScoped && <Eye size={18} className="text-[#1CB0F6]" />}
            <span className="text-xs font-extrabold text-[#1CB0F6] uppercase">{hud.weaponName}</span>
            <span className="text-xl font-black text-white">
              {hud.reloading ? (
                <span className="text-[#FFC800]">RELOADING...</span>
              ) : (
                <>
                  <span className="text-[#58CC02]">{hud.ammo}</span>
                  <span className="text-[#52656D]"> / {hud.reserveAmmo}</span>
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {deviceMode === 'phone' && (
        <div className="fixed top-20 right-4 duo-card px-3 py-1.5 text-xs font-black">
          {hud.reloading ? (
            <span className="text-[#FFC800]">RELOADING...</span>
          ) : (
            <span>
              {hud.weaponName.split(' ')[0]} <span className="text-[#58CC02]">{hud.ammo}</span>/{hud.reserveAmmo}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
