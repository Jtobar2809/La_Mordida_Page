"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

const colors = ["#E85C2B", "#F0A93A", "#4A5A34", "#7A6C58", "#C7451D"];

export function TopProductsChart({ data }: { data: { name: string; unidades: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E3DC" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12, fill: "#A99C88" }} axisLine={false} tickLine={false} />
        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fill: "#4E4436" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E8E3DC" }} />
        <Bar dataKey="unidades" radius={[0, 8, 8, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
