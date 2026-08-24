-- Historia de los costos fijos.
--
-- El problema que arregla: el estado de resultados leía `activo = true` para
-- CUALQUIER mes consultado. Subir el arriendo en octubre reescribía enero con
-- el arriendo de octubre, y desactivar un costo lo borraba de todos los meses
-- ya cerrados. Un período cerrado no puede cambiar solo.

ALTER TABLE "CostoFijo" ADD COLUMN "vigenteDesde" TIMESTAMP(3);
ALTER TABLE "CostoFijo" ADD COLUMN "vigenteHasta" TIMESTAMP(3);

-- Relleno de las filas que ya existen. Lo mejor que se puede saber de ellas es
-- cuándo se crearon; se ancla al día 1 de ese mes para que el mes en que se
-- registró el costo lo cuente entero, que es como se paga un arriendo.
UPDATE "CostoFijo"
SET "vigenteDesde" = date_trunc('month', "createdAt")
WHERE "vigenteDesde" IS NULL;

-- Un costo ya desactivado dejó de aplicar; se cierra al día 1 del mes en que se
-- tocó por última vez. `vigenteHasta` es EXCLUSIVO, así que ese mes ya no lo
-- cuenta.
UPDATE "CostoFijo"
SET "vigenteHasta" = date_trunc('month', "updatedAt")
WHERE "activo" = false AND "vigenteHasta" IS NULL;

-- Un cierre nunca puede quedar antes de la apertura: si alguien creó y
-- desactivó el costo el mismo mes, la fila queda vacía en vez de negativa.
UPDATE "CostoFijo"
SET "vigenteHasta" = "vigenteDesde"
WHERE "vigenteHasta" IS NOT NULL AND "vigenteHasta" < "vigenteDesde";

ALTER TABLE "CostoFijo" ALTER COLUMN "vigenteDesde" SET NOT NULL;
ALTER TABLE "CostoFijo" ALTER COLUMN "vigenteDesde" SET DEFAULT CURRENT_TIMESTAMP;

-- "Arriendo" ahora existe una vez por cada monto que tuvo en el tiempo, así que
-- el nombre deja de ser único. La unicidad de lo VIGENTE la impone el servidor
-- (upsertCostoFijo), que es donde se sabe qué es "vigente".
DROP INDEX "CostoFijo_nombre_key";
CREATE INDEX "CostoFijo_nombre_idx" ON "CostoFijo"("nombre");
CREATE INDEX "CostoFijo_vigenteDesde_idx" ON "CostoFijo"("vigenteDesde");
