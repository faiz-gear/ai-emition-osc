"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";

import type { EmotionResult } from "@/lib/types";

const KEYS: Array<{ key: keyof EmotionResult["dimensions"]; label: string }> = [
  { key: "joy", label: "Joy" },
  { key: "trust", label: "Trust" },
  { key: "fear", label: "Fear" },
  { key: "surprise", label: "Surprise" },
  { key: "sadness", label: "Sadness" },
  { key: "disgust", label: "Disgust" },
  { key: "anger", label: "Anger" },
  { key: "anticipation", label: "Anticipation" }
];

export function EmotionRadar({ emotion }: { emotion: EmotionResult | null }) {
  const data =
    emotion === null
      ? KEYS.map((k) => ({ dimension: k.label, value: 0 }))
      : KEYS.map((k) => ({
          dimension: k.label,
          value: emotion.dimensions[k.key]
        }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid stroke="rgba(89, 99, 93, 0.2)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: "#59635d", fontSize: 12 }} />
          <Radar
            dataKey="value"
            stroke="#0f766e"
            fill="#0f766e"
            fillOpacity={0.22}
            dot={false}
          />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
