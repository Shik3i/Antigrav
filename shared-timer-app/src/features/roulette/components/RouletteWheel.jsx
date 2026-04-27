import React, { useEffect, useRef, useState } from 'react';

const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const SIZE = 300;
const R = SIZE / 2;
const INNER_R = R * 0.35;
const NUM_SEGMENTS = 37;
const SEGMENT_ANGLE = (2 * Math.PI) / NUM_SEGMENTS;

function polarToCartesian(cx, cy, r, angle) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function segmentPath(cx, cy, r, innerR, startAngle, endAngle) {
  const o1 = polarToCartesian(cx, cy, r, startAngle);
  const o2 = polarToCartesian(cx, cy, r, endAngle);
  const i1 = polarToCartesian(cx, cy, innerR, endAngle);
  const i2 = polarToCartesian(cx, cy, innerR, startAngle);
  return `M ${o1.x} ${o1.y} A ${r} ${r} 0 0 1 ${o2.x} ${o2.y} L ${i1.x} ${i1.y} A ${innerR} ${innerR} 0 0 0 ${i2.x} ${i2.y} Z`;
}

export default function RouletteWheel({ spinResult, spinning }) {
  const wheelRef = useRef(null);
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevRotation = useRef(0);
  const lastSpinRoundId = useRef(null);
  const animTimerRef = useRef(null);

  useEffect(() => {
    if (!spinResult) return;
    // Only trigger animation once per round (spinResult.roundId tracks this)
    if (lastSpinRoundId.current === spinResult.roundId) return;
    lastSpinRoundId.current = spinResult.roundId;

    const idx = WHEEL_ORDER.indexOf(spinResult.number);
    if (idx === -1) return;

    const segmentDeg = 360 / NUM_SEGMENTS;
    const targetAngle = (360 - ((idx + 0.5) * segmentDeg) + 360) % 360;
    const fullSpins = 5 * 360;
    const nextRotation = prevRotation.current + fullSpins + ((targetAngle - (prevRotation.current % 360) + 360) % 360);
    prevRotation.current = nextRotation;

    setIsAnimating(true);
    setRotation(nextRotation);

    clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => setIsAnimating(false), 8000);
  }, [spinResult]);

  const cx = R, cy = R;

  return (
    <div className="roulette-wheel-wrapper">
      {/* Pointer marker at top */}
      <div className="roulette-pointer" />
      <svg
        ref={wheelRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="roulette-wheel-svg"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isAnimating ? 'transform 8s cubic-bezier(0.17, 0.67, 0.12, 1.0)' : 'none',
        }}
      >
        {WHEEL_ORDER.map((num, i) => {
          const startAngle = i * SEGMENT_ANGLE - Math.PI / 2;
          const endAngle = startAngle + SEGMENT_ANGLE;
          const midAngle = startAngle + SEGMENT_ANGLE / 2;
          const color = num === 0 ? '#1a7a3c' : RED_NUMBERS.has(num) ? '#c0392b' : '#1a1a1a';
          const textPos = polarToCartesian(cx, cy, R * 0.75, midAngle);
          const textAngleDeg = (midAngle * 180) / Math.PI + 90;

          return (
            <g key={num}>
              <path
                d={segmentPath(cx, cy, R - 2, INNER_R, startAngle, endAngle)}
                fill={color}
                stroke="#b8960c"
                strokeWidth="1"
              />
              <text
                x={textPos.x}
                y={textPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f5e6a3"
                fontSize="9"
                fontFamily="'Playfair Display', serif"
                transform={`rotate(${textAngleDeg}, ${textPos.x}, ${textPos.y})`}
              >
                {num}
              </text>
            </g>
          );
        })}
        {/* Center cap */}
        <circle cx={cx} cy={cy} r={INNER_R} fill="#0d0d0d" stroke="#b8960c" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={INNER_R * 0.4} fill="#b8960c" />
      </svg>
      {/* Result display */}
      {spinResult && !isAnimating && (
        <div className={`roulette-result-badge roulette-result-${spinResult.color}`}>
          {spinResult.number}
        </div>
      )}
    </div>
  );
}
