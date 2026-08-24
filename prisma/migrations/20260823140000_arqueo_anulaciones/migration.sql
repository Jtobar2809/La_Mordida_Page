-- Las ventas anuladas dejan de contarse como venta y como gasto.
--
-- Anular no borra el cobro: deja el VENTA original y le suma un EGRESO que lo
-- compensa. El efectivo cuadraba, pero el turno reportaba la venta anulada
-- como venta y su devolución como "gasto del negocio" — y contradecía a
-- Conciliación, que sí las filtraba.
--
-- Los turnos ya cerrados NO se recalculan: un arqueo que se firmó tiene que
-- seguir diciendo lo que decía el día que se contó la plata. Quedan en NULL.

ALTER TABLE "CajaSesion" ADD COLUMN "totalAnulaciones" INTEGER;
