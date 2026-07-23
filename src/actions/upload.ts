"use server";

import { auth } from "@/auth";
import { cloudinary } from "@/lib/cloudinary";
import type { ActionResult } from "@/actions/auth";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function uploadImage(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return { success: false, error: "No autorizado" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { success: false, error: "Ningún archivo recibido" };
  if (file.size > MAX_SIZE_BYTES) return { success: false, error: "La imagen no debe superar 5MB" };
  if (!ALLOWED_TYPES.includes(file.type)) return { success: false, error: "Formato no soportado (usa JPG, PNG, WEBP o AVIF)" };

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_SECRET) {
    return {
      success: false,
      error: "Cloudinary no está configurado. Agrega las variables CLOUDINARY_* en tu .env o pega una URL de imagen manualmente.",
    };
  }

  try {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "la-mordida",
      resource_type: "image",
      transformation: [{ width: 1600, height: 1600, crop: "limit" }, { quality: "auto", fetch_format: "auto" }],
    });

    return { success: true, data: { url: result.secure_url } };
  } catch (err) {
    console.error("[cloudinary] Error subiendo imagen:", err);
    return { success: false, error: "No se pudo subir la imagen. Intenta de nuevo." };
  }
}
