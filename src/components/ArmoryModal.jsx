import React from 'react';
import { Coins, ArrowUpCircle, X, Check } from 'lucide-react';
import { WEAPONS, UPGRADE_CONFIG } from '../engine/arsenalData';
import { soundEngine } from '../engine/soundEngine';

export default function ArmoryModal({ coins, loadout, onPurchaseWeapon, onEquipWeapon, onUpgradeStat, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#131F24]/92 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="duo-card w-full max-w-4xl p-5 sm:p-7 flex flex-col gap-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#37464F] pb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              TACTICAL <span className="text-[#FFC800]">ARMORY</span>
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[#8FA3AD]">
              Switch between your Glock Handgun, Viper SMG, or unlock heavy rifles
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-2xl bg-[#182429] border-2 border-[#FFC800] flex items-center gap-2">
              <Coins size={20} className="text-[#FFC800]" />
              <span className="text-lg font-black text-[#FFC800]">{coins}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick(460);
                onClose();
              }}
              className="duo-btn duo-btn-red p-2.5"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[#778A94] mb-3">
            1. Select or Unlock Primary Weapon
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {WEAPONS.map((w) => {
              const unlocked = loadout.unlockedWeapons.includes(w.id);
              const equipped = loadout.equippedWeaponId === w.id;
              const canAfford = coins >= w.cost;

              return (
                <div
                  key={w.id}
                  className={`duo-card p-4 flex flex-col justify-between gap-3 ${
                    equipped ? 'duo-card-selected' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-base font-black text-white">{w.name}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-[#131F24] text-[10px] font-black text-[#1CB0F6]">
                        {w.badge}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#8FA3AD] mb-3">{w.description}</p>

                    <div className="grid grid-cols-3 gap-2 text-center bg-[#182429] rounded-xl p-2 text-xs font-black">
                      <div>
                        <div className="text-[10px] text-[#778A94]">DMG</div>
                        <div className="text-[#FF4B4B]">{w.damage}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#778A94]">RATE</div>
                        <div className="text-[#58CC02]">{Math.round(1000 / w.fireRateMs)}/s</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#778A94]">MAG</div>
                        <div className="text-[#FFC800]">{w.baseMag}</div>
                      </div>
                    </div>
                  </div>

                  {equipped ? (
                    <button type="button" disabled className="duo-btn duo-btn-blue w-full py-2.5 text-xs">
                      <Check size={16} /> EQUIPPED
                    </button>
                  ) : unlocked ? (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick(620);
                        onEquipWeapon(w.id);
                      }}
                      className="duo-btn duo-btn-green w-full py-2.5 text-xs"
                    >
                      EQUIP WEAPON
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => {
                        soundEngine.playCoinReward();
                        onPurchaseWeapon(w);
                      }}
                      className="duo-btn duo-btn-gold w-full py-2.5 text-xs"
                    >
                      <Coins size={16} /> BUY ({w.cost} COINS)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[#778A94] mb-3">
            2. Upgrade Weapon Performance
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {Object.values(UPGRADE_CONFIG).map((upg) => {
              const currentLevel = loadout.upgrades[upg.id] || 1;
              const isMax = currentLevel >= upg.maxLevel;
              const cost = upg.baseCost + (currentLevel - 1) * upg.costStep;
              const canAfford = coins >= cost;

              return (
                <div key={upg.id} className="duo-card p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-black text-white">{upg.label}</span>
                      <span className="text-xs font-black text-[#CE82FF]">
                        LV {currentLevel}/{upg.maxLevel}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#8FA3AD] mb-3">{upg.bonusText}</p>

                    <div className="flex gap-1.5 mb-2">
                      {Array.from({ length: upg.maxLevel }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-2.5 flex-1 rounded-full ${
                            i < currentLevel ? 'bg-[#58CC02]' : 'bg-[#131F24]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {isMax ? (
                    <button type="button" disabled className="duo-btn duo-btn-purple w-full py-2.5 text-xs">
                      MAXED OUT
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => {
                        soundEngine.playCoinReward();
                        onUpgradeStat(upg.id, cost);
                      }}
                      className="duo-btn duo-btn-gold w-full py-2.5 text-xs"
                    >
                      <ArrowUpCircle size={16} /> UPGRADE ({cost})
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
