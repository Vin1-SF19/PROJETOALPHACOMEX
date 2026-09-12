"use client";

import { useId } from "react";
import { motion } from "framer-motion";

// NavioLogin.png has transparent padding: the keel is at 77% of the image,
// not its bottom edge. Only the lower ~4% of the image is submerged here.
export function ShipWaterContact() {
  const id = useId().replace(/:/g, "");
  const waterline = "M-30 13 C4 11 22 15 59 12 S104 14 142 11 C162 9 181 14 212 12 S258 10 291 13 C319 15 338 10 377 12 S421 15 463 11 C483 9 512 14 548 12 S605 10 644 13 C667 15 692 10 733 12 S791 14 828 11 C856 9 885 14 917 11 S949 7 974 12 C1001 14 1022 10 1040 12";

  return (
    <div
      className="pointer-events-none absolute left-[-2%] top-[71.5%] z-10 h-[14%] w-[104%]"
      data-water-contact
      aria-hidden="true"
    >
      <svg className="h-full w-full overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${id}-depth`} x2="0" y2="1">
            <stop stopColor="#081722" />
            <stop offset="0.3" stopColor="#07131e" />
            <stop offset="1" stopColor="#050e18" />
          </linearGradient>
          <linearGradient id={`${id}-fade`} x2="0" y2="1">
            <stop stopColor="white" />
            <stop offset="0.3" stopColor="white" />
            <stop offset="1" stopColor="black" />
          </linearGradient>
          <linearGradient id={`${id}-edges`}>
            <stop stopColor="black" />
            <stop offset="0.06" stopColor="white" />
            <stop offset="0.93" stopColor="white" />
            <stop offset="1" stopColor="black" />
          </linearGradient>
          <mask id={`${id}-vertical`}>
            <rect width="1000" height="100" fill={`url(#${id}-fade)`} />
          </mask>
          <mask id={`${id}-mask`}>
            <rect width="1000" height="100" fill={`url(#${id}-edges)`} mask={`url(#${id}-vertical)`} />
          </mask>
          <filter id={`${id}-ripple`} x="-5%" y="-40%" width="110%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.06 0.32" numOctaves="2" seed="8" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <pattern id={`${id}-texture`} width="143" height="23" patternUnits="userSpaceOnUse">
            <path d="M2 6q12-3 27 0m25 4q9-2 24 0m18-8q16-2 32 0M17 20q11-2 28 0m30-3q14-3 32 0" fill="none" stroke="#638496" strokeWidth="0.65" opacity="0.13" />
          </pattern>
        </defs>
        <g mask={`url(#${id}-mask)`}>
          <motion.g
            animate={{ x: [0, -7, 0], y: [0, 1.4, 0] }}
            transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <path d={`${waterline} L1040 110H-30Z`} fill={`url(#${id}-depth)`} filter={`url(#${id}-ripple)`} />
            <path d={`${waterline} L1040 110H-30Z`} fill={`url(#${id}-texture)`} filter={`url(#${id}-ripple)`} />
            <path d={waterline} fill="none" stroke="#7896a6" strokeWidth="1.4" strokeDasharray="17 13 4 19 26 23 2 11" opacity="0.34" filter={`url(#${id}-ripple)`} />
            <path d="M60 31q110-9 220 0t240-1t225 3t180-2" fill="none" stroke="#466577" strokeWidth="1.2" strokeDasharray="28 39 12 28 6 24" opacity="0.3" filter={`url(#${id}-ripple)`} />
            <path d="M180 21q36-5 81-1m51 6q29-4 60-1m255-3q30-2 55 1" fill="none" stroke="#a44b4a" strokeWidth="2" strokeDasharray="8 13 4 9" opacity="0.25" filter={`url(#${id}-ripple)`} />
            {/* Bow faces RIGHT; a little displaced water curls outwards. */}
            <path d="M922 6q17 2 21 9t28 13q-31 5-58 0" fill="none" stroke="#abc2ca" strokeWidth="2.2" strokeDasharray="5 3 10 4 2 6" opacity="0.55" filter={`url(#${id}-ripple)`} />
            <path d="M933 14q26 7 39 22m-47-12q-40 6-77 2" fill="none" stroke="#7797a8" strokeWidth="1" strokeDasharray="7 5 13 8" opacity="0.42" filter={`url(#${id}-ripple)`} />
          </motion.g>
        </g>
      </svg>
    </div>
  );
}
