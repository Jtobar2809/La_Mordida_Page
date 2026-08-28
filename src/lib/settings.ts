import { prisma } from "@/lib/prisma";

export const DEFAULT_SETTINGS = {
  pointsPerPeso: "1000", // 1000 pesos gastados = 1 punto
  deliveryFee: "5000",
  taxRate: "0", // porcentaje, 0 si los precios ya incluyen impuestos
  whatsappNumber: "573108325015",
  storeAddress: "Cra. 7 #10 Norte-22, Barrio Prados del Norte, Popayán, Cauca",
  storeSchedule: "Lun a Dom, 5:00 p.m. – 10:00 p.m.",
  storeLat: "2.451057",
  storeLng: "-76.602570",
  welcomeBonusPoints: "20",
  // Global feature toggles (stringified booleans)
  carouselEnabled: "true",
  // Supuestos del análisis de costos fijos (ver src/lib/operacion.ts). Solo se
  // usan mientras no haya ventas reales del período con las cuales medir; en
  // cuanto las hay, mandan los datos y estos quedan de referencia.
  ventasEstimadasMes: "0",
  ticketPromedioEstimado: "0",
  diasOperacionMes: "30",
  // Cuánto había en Nequi el día que se empezó a llevar el saldo. Es el ancla
  // desde la cual se suman ventas y se restan pagos; sin ella el saldo
  // arrancaría en cero y estaría corrido en exactamente lo que ya había en el
  // celular. En cuanto se hace el primer arqueo manda el arqueo, no esto.
  nequiSaldoInicial: "0",
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
