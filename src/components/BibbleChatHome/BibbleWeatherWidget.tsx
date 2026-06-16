"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WeatherData {
  temp: number;
  icon: string;
  city: string;
}

const REFRESH_MS = 10 * 60 * 1000; // 10 minutos

function weatherIcon(code: number): string {
  if (code <= 1) return "☀️";
  if (code <= 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95 && code <= 99) return "⛈️";
  return "🌡️";
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

export default function BibbleWeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      const [weatherRes, geoRes] = await Promise.all([
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`,
        ),
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        ),
      ]);

      if (!weatherRes.ok) throw new Error("weather");

      const weatherJson = (await weatherRes.json()) as {
        current?: { temperature_2m?: number; weather_code?: number };
      };

      const temp = weatherJson.current?.temperature_2m;
      const code = weatherJson.current?.weather_code;
      if (temp === undefined || code === undefined) throw new Error("no-data");

      let city = "";
      if (geoRes.ok) {
        const geoJson = (await geoRes.json()) as { address?: NominatimAddress };
        const addr = geoJson.address ?? {};
        city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
      }

      setData({ temp: Math.round(temp), icon: weatherIcon(code), city });
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      // Adia para fora do corpo do effect para evitar cascading renders
      const t = setTimeout(() => {
        setError(true);
        setLoading(false);
      }, 0);
      return () => clearTimeout(t);
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const run = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void fetchWeather(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          setError(true);
          setLoading(false);
        },
        { timeout: 10000, maximumAge: REFRESH_MS },
      );
    };

    run();
    intervalId = setInterval(run, REFRESH_MS);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchWeather]);

  // Estado de erro: ocultar o widget
  if (error) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 select-none"
        style={{
          background: "rgba(15,23,42,0.7)",
          border: "1px solid rgba(99,102,241,0.2)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        }}
      >
        {loading || !data ? (
          <span className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>
            ...
          </span>
        ) : (
          <>
            <span className="text-[12px] leading-none">{data.icon}</span>
            <span
              className="text-[12px] font-bold leading-none"
              style={{ color: "#e2e8f0" }}
            >
              {data.temp}°C
            </span>
            {data.city && (
              <span
                className="text-[10px] font-medium leading-none max-w-[90px] truncate"
                style={{ color: "#94a3b8" }}
                title={data.city}
              >
                {data.city}
              </span>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
