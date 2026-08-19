"use client";

import { AperturaCaja } from "./apertura-caja";
import { PosTerminal } from "./pos-terminal";
import type { VentaResumida } from "./ventas-del-turno";
import type { CategoriaPOS, SesionCajaActiva } from "@/types/caja";

/**
 * La caja solo tiene dos estados posibles, y son excluyentes: o hay un turno
 * abierto y se puede vender, o no lo hay y lo único que se puede hacer es
 * abrirlo. Modelarlo como una bifurcación de un solo `if` (en vez de una
 * pantalla con botones deshabilitados) evita el caso en que alguien vende sin
 * turno y esa plata no aparece en ningún arqueo.
 */
export function CajaWorkspace({
  sesion,
  catalogo,
  ventas,
}: {
  sesion: SesionCajaActiva | null;
  catalogo: CategoriaPOS[];
  ventas: VentaResumida[];
}) {
  if (!sesion) return <AperturaCaja />;

  return <PosTerminal sesion={sesion} catalogo={catalogo} ventas={ventas} />;
}
