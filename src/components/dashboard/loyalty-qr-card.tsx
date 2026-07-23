"use client";

import { QRCodeSVG } from "qrcode.react";

export function LoyaltyQrCard({ userId, name }: { userId: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-charcoal-100 bg-white p-6 text-center dark:border-charcoal-700 dark:bg-charcoal-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">Tu código personal</p>
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <QRCodeSVG value={`LAMORDIDA:CLIENTE:${userId}`} size={140} fgColor="#1B1712" />
      </div>
      <p className="font-mono text-xs text-charcoal-400">{userId.slice(-10).toUpperCase()}</p>
      <p className="text-xs text-charcoal-400">Muéstralo en caja para identificarte como cliente frecuente, {name.split(" ")[0]}.</p>
    </div>
  );
}
