import React, { useRef, useState } from 'react';
import { Crosshair, ArrowUp, RotateCw, Eye, Shield } from 'lucide-react';

export default function TouchControls({
  inCover,
  isScoped,
  onMoveChange,
  onLookDelta,
  onFire,
  onToggleScope,
  onToggleCover,
  onJump,
  onReload
}) {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [moveLabel, setMoveLabel] = useState('MOVE');
  const joyTouchId = useRef(null);
  const joyOrigin = useRef({ x: 0, y: 0 });

  const lookTouchId = useRef(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  const maxRadius = 48;

  const handleJoyStart = (e) => {
    e.stopPropagation();
    const touch = e.changedTouches[0];
    joyTouchId.current = touch.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    joyOrigin.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    updateJoystick(touch.clientX, touch.clientY);
  };

  const updateJoystick = (clientX, clientY) => {
    const dx = clientX - joyOrigin.current.x;
    const dy = clientY - joyOrigin.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;
    setKnobPos({ x: kx, y: ky });

    const normX = kx / maxRadius;
    const normY = -ky / maxRadius;

    if (normY > 0.25) setMoveLabel('RUN ▲');
    else if (normY < -0.25) setMoveLabel('BACK ▼');
    else setMoveLabel('MOVE');

    onMoveChange({ x: normX, y: normY });
  };

  const handleJoyMove = (e) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchId.current) {
        updateJoystick(t.clientX, t.clientY);
      }
    }
  };

  const handleJoyEnd = (e) => {
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        joyTouchId.current = null;
        setKnobPos({ x: 0, y: 0 });
        setMoveLabel('MOVE');
        onMoveChange({ x: 0, y: 0 });
      }
    }
  };

  const handleLookStart = (e) => {
    const touch = e.changedTouches[0];
    lookTouchId.current = touch.identifier;
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleLookMove = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        const dx = t.clientX - lastLookPos.current.x;
        const dy = t.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: t.clientX, y: t.clientY };
        const sens = isScoped ? 0.0028 : 0.0055;
        onLookDelta(dx * sens, dy * sens);
      }
    }
  };

  const handleLookEnd = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none">
      <div
        className="absolute top-0 right-0 w-3/5 h-full pointer-events-auto"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      />

      <div
        className="duo-joystick-base absolute bottom-6 left-7 flex items-center justify-center pointer-events-auto"
        style={{ width: '136px', height: '136px' }}
        onTouchStart={handleJoyStart}
        onTouchMove={handleJoyMove}
        onTouchEnd={handleJoyEnd}
        onTouchCancel={handleJoyEnd}
      >
        <span className="absolute top-2 text-[10px] font-black text-white/70 tracking-wider">▲ RUN</span>
        <span className="absolute bottom-2 text-[10px] font-black text-white/70 tracking-wider">▼ BACK</span>

        <div
          className="duo-joystick-knob flex items-center justify-center text-[10px] font-black text-white shadow-md"
          style={{
            width: '60px',
            height: '60px',
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`
          }}
        >
          {moveLabel}
        </div>
      </div>

      <div className="absolute bottom-6 right-7 flex items-end gap-3.5 pointer-events-auto">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            aria-label="Take Cover"
            onTouchStart={(e) => {
              e.stopPropagation();
              onToggleCover();
            }}
            className={`duo-touch-btn duo-touch-cover text-white ${inCover ? 'active-toggle' : ''}`}
            style={{ width: '62px', height: '62px' }}
          >
            <Shield size={22} strokeWidth={2.8} />
            <span className="text-[9px] font-black mt-0.5">{inCover ? 'IN COVER' : 'COVER'}</span>
          </button>

          <button
            type="button"
            aria-label="Reload"
            onTouchStart={(e) => {
              e.stopPropagation();
              onReload();
            }}
            className="duo-touch-btn duo-touch-reload text-white"
            style={{ width: '62px', height: '62px' }}
          >
            <RotateCw size={22} strokeWidth={2.8} />
            <span className="text-[9px] font-black mt-0.5">RELOAD</span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            aria-label="Aim Sight"
            onTouchStart={(e) => {
              e.stopPropagation();
              onToggleScope();
            }}
            className={`duo-touch-btn duo-touch-scope text-white ${isScoped ? 'active-toggle' : ''}`}
            style={{ width: '66px', height: '66px' }}
          >
            <Eye size={24} strokeWidth={2.8} />
            <span className="text-[9px] font-black mt-0.5">{isScoped ? 'ADS ON' : 'AIM'}</span>
          </button>

          <button
            type="button"
            aria-label="Jump"
            onTouchStart={(e) => {
              e.stopPropagation();
              onJump();
            }}
            className="duo-touch-btn duo-touch-jump text-white"
            style={{ width: '66px', height: '66px' }}
          >
            <ArrowUp size={26} strokeWidth={3} />
            <span className="text-[9px] font-black">JUMP</span>
          </button>
        </div>

        <button
          type="button"
          aria-label="Fire"
          onTouchStart={(e) => {
            e.stopPropagation();
            onFire();
          }}
          className="duo-touch-btn duo-touch-fire text-white"
          style={{ width: '92px', height: '92px' }}
        >
          <Crosshair size={38} strokeWidth={3} />
          <span className="text-[10px] font-black mt-0.5">FIRE</span>
        </button>
      </div>
    </div>
  );
}
