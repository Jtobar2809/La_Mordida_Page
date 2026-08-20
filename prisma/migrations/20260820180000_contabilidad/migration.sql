-- Gastos sueltos que no son insumos ni recurrentes.
CREATE TYPE "GastoCategoria" AS ENUM ('MANTENIMIENTO', 'PUBLICIDAD', 'TRANSPORTE', 'IMPUESTOS', 'EQUIPOS', 'DOMICILIOS', 'OTRO');

CREATE TABLE "Gasto" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concepto" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "categoria" "GastoCategoria" NOT NULL DEFAULT 'OTRO',
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "notas" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Gasto_fecha_idx" ON "Gasto"("fecha");
CREATE INDEX "Gasto_categoria_idx" ON "Gasto"("categoria");

-- Marca el retiro de socios. En el punto de equilibrio cuenta (hay que venderlo
-- igual), pero en el estado de resultados va DEBAJO de la utilidad: repartir la
-- ganancia no es un costo de operar.
ALTER TABLE "CostoFijo" ADD COLUMN "esRetiro" BOOLEAN NOT NULL DEFAULT false;

-- El que ya existe se marca por nombre una sola vez, aquí. De ahí en adelante
-- manda el flag, para que renombrarlo no cambie cómo se contabiliza.
UPDATE "CostoFijo" SET "esRetiro" = true WHERE "nombre" = 'Retiro de socios';
