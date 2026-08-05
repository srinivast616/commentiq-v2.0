"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#3ED6B5",
  neutral: "#F2B84B",
  negative: "#FF6B5E",
};

export function SentimentDonut({ distribution }: { distribution: Record<string, number> }) {
  const data = Object.entries(distribution).map(([name, value]) => ({ name, value: Math.round(value * 100) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] ?? "#7A8394"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: "#1B1F26", border: "1px solid #333A45", borderRadius: 8, color: "#E7EAEE" }}
          formatter={(value: number) => `${value}%`}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopicBarChart({ topics }: { topics: { topic: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={topics} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#252A33" horizontal={false} />
        <XAxis type="number" stroke="#7A8394" fontSize={12} />
        <YAxis type="category" dataKey="topic" stroke="#7A8394" fontSize={12} width={120} />
        <Tooltip contentStyle={{ backgroundColor: "#1B1F26", border: "1px solid #333A45", borderRadius: 8, color: "#E7EAEE" }} />
        <Bar dataKey="count" fill="#3ED6B5" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LanguageBarChart({ languages }: { languages: { language: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={languages}>
        <CartesianGrid strokeDasharray="3 3" stroke="#252A33" vertical={false} />
        <XAxis dataKey="language" stroke="#7A8394" fontSize={12} />
        <YAxis stroke="#7A8394" fontSize={12} />
        <Tooltip contentStyle={{ backgroundColor: "#1B1F26", border: "1px solid #333A45", borderRadius: 8, color: "#E7EAEE" }} />
        <Bar dataKey="count" fill="#F2B84B" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EmotionBarChart({ emotions }: { emotions: Record<string, number> }) {
  const data = Object.entries(emotions)
    .map(([emotion, value]) => ({ emotion, value: Math.round(value * 100) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#252A33" horizontal={false} />
        <XAxis type="number" stroke="#7A8394" fontSize={12} />
        <YAxis type="category" dataKey="emotion" stroke="#7A8394" fontSize={12} width={100} />
        <Tooltip contentStyle={{ backgroundColor: "#1B1F26", border: "1px solid #333A45", borderRadius: 8, color: "#E7EAEE" }} />
        <Bar dataKey="value" fill="#7A8394" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
