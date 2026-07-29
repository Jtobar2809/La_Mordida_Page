import { prisma } from "@/lib/prisma";

export const DEFAULT_SETTINGS = {
  pointsPerPeso: "1000", // 1000 pesos gastados = 1 punto
  deliveryFee: "5000",
  taxRate: "0", // porcentaje, 0 si los precios ya incluyen impuestos
  whatsappNumber: "573108325015",
  storeAddress: "Cra. 12 #34-56, Popayán, Cauca",
  storeSchedule: "Lun a Dom, 11:00 a.m. – 10:00 p.m.",
  storeLat: "2.4448",
  storeLng: "-76.6147",
  welcomeBonusPoints: "20",
  // Global feature toggles (stringified booleans)
  carouselEnabled: "true",
};

export type SettingsKey = keyof typeof DEFAULT_SETTINGS;

/** Devuelve todas las configuraciones fusionadas con los valores por defecto */
export async function getSettings(): Promise<typeof DEFAULT_SETTINGS> {
  const rows = await prisma.settings.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...map } as typeof DEFAULT_SETTINGS;
}

export async function getSetting(key: SettingsKey): Promise<string> {
  const row = await prisma.settings.findUnique({ where: { key } });
  return row?.value ?? DEFAULT_SETTINGS[key];
}

export async function setSetting(key: SettingsKey, value: string) {
  await prisma.settings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
