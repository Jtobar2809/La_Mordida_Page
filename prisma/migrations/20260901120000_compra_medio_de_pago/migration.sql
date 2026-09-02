-- Con qué se le pagó al proveedor, y el vínculo con el egreso de caja.
--
-- El problema que arregla: una Compra sumaba stock pero no bajaba de ninguna
-- parte. El bulto de papas quedaba en la bodega y su valor seguía figurando en
-- el cajón, así que el cuadro de saldos mostraba una plata que ya no existía.
-- Lo único que hacía el sistema era una alerta pidiendo que el dueño hiciera la
-- resta de cabeza.
--
-- `compraId` es el espejo de `gastoId`: dice cuáles compras ya salieron por la
-- caja, para que el saldo descuente por fuera solo las que no pasaron por ahí y
-- ninguna se reste dos veces.

ALTER TABLE "Compra" ADD COLUMN "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO';

ALTER TABLE "MovimientoCaja" ADD COLUMN "compraId" TEXT;

CREATE UNIQUE INDEX "MovimientoCaja_compraId_key" ON "MovimientoCaja"("compraId");

ALTER TABLE "MovimientoCaja"
  ADD CONSTRAINT "MovimientoCaja_compraId_fkey"
  FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;
