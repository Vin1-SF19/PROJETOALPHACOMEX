"use client";

import { memo, useMemo } from "react";

type Props = {
  reducedMotion: boolean;
  active: boolean;
};

type Route = {
  id: number;
  d: string;
  duration: number;
  delay: number;
  dash: number;
};

const ROUTES: Route[] = [
  { id: 0, d: "M 120 560 C 360 380 640 300 980 360", duration: 7, delay: 0.2, dash: 260 },
  { id: 1, d: "M 180 600 C 480 470 760 430 1120 470", duration: 9, delay: 1.4, dash: 320 },
  { id: 2, d: "M 240 640 C 560 560 900 520 1240 560", duration: 11, delay: 2.6, dash: 380 },
  { id: 3, d: "M 150 520 C 420 300 780 240 1180 300", duration: 8, delay: 3.4, dash: 300 },
  { id: 4, d: "M 300 660 C 640 600 980 560 1300 620", duration: 12, delay: 4.2, dash: 420 },
];

function GlobalRoutesComponent({ reducedMotion, active }: Props) {
  const routes = useMemo(() => ROUTES, []);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden
      style={{ opacity: active ? 1 : 0.55, transition: "opacity 600ms ease" }}
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1400 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <filter id="loginRouteGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {routes.map((r) => (
          <g key={r.id} filter="url(#loginRouteGlow)">
            <path
              d={r.d}
              stroke="rgba(239,68,68,0.10)"
              strokeWidth={1}
              fill="none"
            />
            <path
              d={r.d}
              stroke="rgba(239,68,68,0.55)"
              strokeWidth={1.4}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${r.dash} 900`}
              style={
                reducedMotion
                  ? undefined
                  : {
                      animation: `loginRouteFlow ${r.duration}s linear ${r.delay}s infinite`,
                    }
              }
            />
          </g>
        ))}

        {routes.map((r) => (
          <circle
            key={`node-${r.id}`}
            cx={r.id % 2 === 0 ? 120 + r.id * 40 : 1180 - r.id * 30}
            cy={560 - r.id * 30}
            r={2.4}
            fill="rgba(239,68,68,0.9)"
            style={
              reducedMotion
                ? undefined
                : {
                    animation: `loginLed 4s ease-in-out ${r.delay}s infinite`,
                  }
            }
          />
        ))}
      </svg>
    </div>
  );
}

export const GlobalRoutes = memo(GlobalRoutesComponent);
