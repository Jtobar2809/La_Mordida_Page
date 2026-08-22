-- Retiros de socios: la plata que los dueños sacan para vivir.
--
-- Hasta hoy se registraba como EGRESO, y eso mezclaba dos cosas distintas: un
-- pago al proveedor es un costo de operar, un retiro es repartir la ganancia.
-- Con el tipo propio, el turno puede mostrar "gastos" y "retiros" por separado
-- y la contabilidad puede seguir restando el retiro DEBAJO de la utilidad.
--
-- Los EGRESOS ya registrados se quedan como están: un libro de caja no se
-- reescribe hacia atrás.
ALTER TYPE "MovimientoCajaTipo" ADD VALUE 'RETIRO';

-- Snapshot congelado al cerrar el turno, igual que los demás totales. Queda
-- NULL en los turnos ya cerrados, que es la verdad: cuando se firmaron, esta
-- cifra no se medía.
ALTER TABLE "CajaSesion" ADD COLUMN "totalRetiros" INTEGER;
