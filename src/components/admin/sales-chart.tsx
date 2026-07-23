"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCOP } from "@/lib/utils";

export function SalesChart({ data }: { data: { label: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E85C2B" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#E85C2B" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8E3DC" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#A99C88" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#A99C88" }} axisLine={false} tickLine={false} width={80} tickFormatter={(v) => formatCOP(v)} />
        <Tooltip formatter={(v: number) => formatCOP(v)} contentStyle={{ borderRadius: 12, border: "1px solid #E8E3DC" }} />
        <Area type="monotone" dataKey="total" stroke="#E85C2B" strokeWidth={2.5} fill="url(#salesFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
