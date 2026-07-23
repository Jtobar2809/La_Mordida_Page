"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, Link2, X, Loader2, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { uploadImage } from "@/actions/upload";

export function ImageUploader({
  value,
  onChange,
  label = "Imagen",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = React.useState(false);
  const [manualMode, setManualMode] = React.useState(false);

  const handleFile = async (file: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadImage(formData);
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    onChange(result.data!.url);
    toast.success("Imagen subida");
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-charcoal-700 dark:text-charcoal-100">{label}</span>
        <button
          type="button"
          onClick={() => setManualMode((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-ember-600 hover:underline"
        >
          <Link2 className="h-3 w-3" />
          {manualMode ? "Subir archivo en su lugar" : "Pegar URL en su lugar"}
        </button>
      </div>

      {manualMode ? (
        <Input placeholder="https://res.cloudinary.com/..." value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <div className="flex items-center gap-3">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-charcoal-200 bg-charcoal-50 dark:border-charcoal-600 dark:bg-charcoal-900/40">
            {value ? (
              <Image src={value} alt="Vista previa" fill className="object-cover" sizes="80px" />
            ) : (
              <ImageOff className="h-6 w-6 text-charcoal-300" />
            )}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-charcoal-900/50">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={loading}>
              <Upload className="h-3.5 w-3.5" /> {loading ? "Subiendo..." : value ? "Cambiar imagen" : "Subir imagen"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                <X className="h-3.5 w-3.5" /> Quitar
              </Button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </div>
      )}
      <p className="mt-1 text-xs text-charcoal-400">JPG, PNG, WEBP o AVIF · máx. 5MB</p>
    </div>
  );
}
