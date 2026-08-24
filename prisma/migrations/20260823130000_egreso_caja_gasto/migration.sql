-- Vínculo entre el libro de caja y el libro de gastos.
--
-- El problema que arregla: los dos libros vivían separados y se contradecían.
-- Pagarle al domiciliario con plata del cajón se registraba como EGRESO —salía
-- del arqueo— pero nunca llegaba al estado de resultados. Y al revés: un Gasto
-- en efectivo anotado aparte vaciaba el cajón sin que la caja se enterara, y el
-- turno cerraba con un faltante que nadie sabía explicar.

ALTER TABLE "MovimientoCaja" ADD COLUMN "gastoId" TEXT;

CREATE UNIQUE INDEX "MovimientoCaja_gastoId_key" ON "MovimientoCaja"("gastoId");

ALTER TABLE "MovimientoCaja"
  ADD CONSTRAINT "MovimientoCaja_gastoId_fkey"
  FOREIGN KEY ("gastoId") REFERENCES "Gasto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
