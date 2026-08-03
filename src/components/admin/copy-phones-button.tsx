"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyPhonesButton({ phones }: { phones: string[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (phones.length === 0) return;
    await navigator.clipboard.writeText(phones.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleCopy} disabled={phones.length === 0}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiado" : `Copiar ${phones.length} teléfono(s)`}
    </Button>
  );
}
