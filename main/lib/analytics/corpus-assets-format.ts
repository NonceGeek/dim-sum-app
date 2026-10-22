/** Client-safe formatting for the corpus asset dashboard (#509). */

export type MeasureLike = { value: number; missing: number };

/** 1 h 2 min 3 s style parts; the caller supplies localized unit labels. */
export function durationParts(seconds: number) {
  const total = Math.round(seconds);
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

export function formatDuration(seconds: number, units: { h: string; m: string; s: string }) {
  const { h, m, s } = durationParts(seconds);
  if (h) return `${h} ${units.h} ${m} ${units.m}`;
  if (m) return `${m} ${units.m} ${s} ${units.s}`;
  return `${s} ${units.s}`;
}

/** Binary-scaled size, auto-picking MB / GB / TB (KB only for tiny values). */
export function formatBytes(bytes: number) {
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(value >= 10 ? 1 : 2)} ${units[i]}`;
}

/**
 * "Pending" when nothing has been measured yet; otherwise the measured part,
 * flagged as partial when some resources still lack the value. Never shows 0
 * for unmeasured data.
 */
export function measureState(m: MeasureLike, resources: number): "empty" | "pending" | "partial" | "complete" {
  if (resources === 0) return "empty";
  if (m.missing >= resources) return "pending";
  return m.missing > 0 ? "partial" : "complete";
}

/** RFC 4180 CSV with a BOM so Excel opens Chinese text correctly. */
export function toCsv(header: string[], rows: Array<Array<string | number>>) {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
