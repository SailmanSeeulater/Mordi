import { useId, useRef, useState } from 'react';
import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, rgbToHex } from '../lib/customTheme';

const round = (n) => Math.round(n);

/**
 * A hue and saturation wheel, a brightness slider, and the same color as hex
 * and as red, green and blue — four ways into one value.
 *
 * HSV is kept in local state rather than recomputed from the hex each render:
 * at zero saturation or zero brightness the hex no longer carries a hue, and
 * the handle would otherwise jump back to red.
 */
export default function ColorWheel({ value, onChange, label }) {
  const wheelRef = useRef(null);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [seen, setSeen] = useState(value);
  const ids = useId();

  // A new value from outside (another role picked, a typed hex, a reset).
  if (value !== seen) {
    setSeen(value);
    if (hsvToHex(hsv) !== value) setHsv(hexToHsv(value));
  }

  const commit = (next) => {
    setHsv(next);
    onChange(hsvToHex(next));
  };

  const pickAt = (e) => {
    const rect = wheelRef.current.getBoundingClientRect();
    const radius = rect.width / 2;
    const dx = e.clientX - rect.left - radius;
    const dy = e.clientY - rect.top - radius;
    // Clockwise from the top, matching the conic-gradient.
    const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const s = Math.min(1, Math.hypot(dx, dy) / radius);
    commit({ ...hsv, h, s });
  };

  const onKeyDown = (e) => {
    const step = e.shiftKey ? 15 : 3;
    const moves = {
      ArrowLeft: { h: (hsv.h - step + 360) % 360 },
      ArrowRight: { h: (hsv.h + step) % 360 },
      ArrowUp: { s: Math.min(1, hsv.s + step / 100) },
      ArrowDown: { s: Math.max(0, hsv.s - step / 100) },
    };
    if (!moves[e.key]) return;
    e.preventDefault();
    commit({ ...hsv, ...moves[e.key] });
  };

  const rad = (hsv.h * Math.PI) / 180;
  const pure = hsvToHex({ h: hsv.h, s: hsv.s, v: 1 });
  const rgb = hexToRgb(value);

  return (
    <div className="cwheel" role="group" aria-label={label}>
      <div className="cwheel__dial">
        <div
          ref={wheelRef}
          className="cwheel__wheel"
          role="slider"
          tabIndex={0}
          aria-label={`${label}: hue and saturation`}
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={round(hsv.h)}
          aria-valuetext={`Hue ${round(hsv.h)} degrees, saturation ${round(hsv.s * 100)} percent`}
          style={{ '--shade': 1 - hsv.v }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pickAt(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) pickAt(e);
          }}
          onKeyDown={onKeyDown}
        >
          <span
            className="cwheel__handle"
            style={{
              left: `${50 + Math.sin(rad) * hsv.s * 50}%`,
              top: `${50 - Math.cos(rad) * hsv.s * 50}%`,
              background: value,
            }}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="cwheel__fields">
        <label className="cwheel__bright" htmlFor={`${ids}-v`}>
          <span className="cwheel__caption">Brightness</span>
          <input
            id={`${ids}-v`}
            type="range"
            min={0}
            max={100}
            value={round(hsv.v * 100)}
            style={{ '--pure': pure }}
            onChange={(e) => commit({ ...hsv, v: Number(e.target.value) / 100 })}
          />
        </label>

        <div className="cwheel__codes">
          <TextCode
            id={`${ids}-hex`}
            caption="Hex"
            value={value}
            parse={(raw) => normalizeHex(raw)}
            onCommit={onChange}
            wide
          />
          {['R', 'G', 'B'].map((name, i) => (
            <TextCode
              key={name}
              id={`${ids}-${name}`}
              caption={name}
              value={String(rgb[i])}
              inputMode="numeric"
              parse={(raw) => {
                if (!/^\d{1,3}$/.test(raw.trim())) return null;
                const n = Number(raw);
                if (n > 255) return null;
                const next = [...rgb];
                next[i] = n;
                return rgbToHex(next);
              }}
              onCommit={onChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A text box that keeps whatever is being typed until it parses, so a field
 * can be cleared and retyped. Leaving it with something unparseable puts the
 * real value back.
 */
function TextCode({ id, caption, value, parse, onCommit, wide = false, inputMode }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }

  return (
    <label className={'cwheel__code' + (wide ? ' cwheel__code--wide' : '')} htmlFor={id}>
      <span className="cwheel__caption">{caption}</span>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        spellCheck={false}
        autoComplete="off"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          // Only a complete value applies while typing; "#abc" waits for blur.
          const complete = wide ? /^#?[0-9a-f]{6}$/i.test(e.target.value.trim()) : true;
          const parsed = complete ? parse(e.target.value) : null;
          if (parsed) onCommit(parsed);
        }}
        onBlur={() => {
          const parsed = parse(draft);
          if (parsed) onCommit(parsed);
          setDraft(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}
