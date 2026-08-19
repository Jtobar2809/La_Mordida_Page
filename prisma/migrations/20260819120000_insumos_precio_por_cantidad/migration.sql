-- Costos con decimales.
-- El costo por unidad casi nunca es entero: la mayonesa se compra por tarro de
-- 3.000 g y el aceite por garrafa de 5 l. Guardarlo como Int redondeaba $8.333/g
-- a $8/g y ese error se multiplicaba por cada gramo de cada receta.
ALTER TABLE "Insumo" ALTER COLUMN "costoUnitario" SET DATA TYPE DOUBLE PRECISION;
ALTER TABLE "MovimientoInsumo" ALTER COLUMN "costoUnitario" SET DATA TYPE DOUBLE PRECISION;
ALTER TABLE "CompraItem" ALTER COLUMN "costoUnitario" SET DATA TYPE DOUBLE PRECISION;
ALTER TABLE "Produccion" ALTER COLUMN "costoUnitario" SET DATA TYPE DOUBLE PRECISION;

-- Precio "como se compra": $25.000 por 3.000 g, en vez de obligar a calcular a mano
-- el precio de un solo gramo.
ALTER TABLE "Insumo" ADD COLUMN "precioReferencia" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Insumo" ADD COLUMN "cantidadReferencia" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- Rendimiento de una tanda de un insumo elaborado (la olla de aderezo da 700 g).
-- Arranca en 1 a propósito: con rendimiento = 1 la composición existente sigue
-- significando exactamente lo mismo que antes ("por cada 1 unidad"), así que
-- ningún costo ni consumo cambia hasta que se edite el rendimiento a mano.
ALTER TABLE "Insumo" ADD COLUMN "rendimiento" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- Los insumos que ya existen quedan con su costo actual expresado como
-- "ese precio por 1 unidad", que es justo lo que valían antes.
UPDATE "Insumo" SET "precioReferencia" = "costoUnitario", "cantidadReferencia" = 1;
