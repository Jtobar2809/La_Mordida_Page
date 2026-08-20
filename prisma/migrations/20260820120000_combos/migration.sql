-- Combos armados con otros productos del menú.
-- Arranca en false para todos: ningún producto existente cambia de comportamiento
-- hasta que se marque como combo a mano.
ALTER TABLE "Product" ADD COLUMN "esCombo" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ComboItem" (
    "id" TEXT NOT NULL,
    "comboId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComboItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComboItem_comboId_productoId_key" ON "ComboItem"("comboId", "productoId");
CREATE INDEX "ComboItem_comboId_idx" ON "ComboItem"("comboId");
CREATE INDEX "ComboItem_productoId_idx" ON "ComboItem"("productoId");

-- Borrar el combo se lleva sus líneas; borrar un producto que está DENTRO de un
-- combo se bloquea, para no dejar un combo apuntando al vacío sin que nadie se
-- entere de que su costo acaba de bajar solo.
ALTER TABLE "ComboItem" ADD CONSTRAINT "ComboItem_comboId_fkey"
    FOREIGN KEY ("comboId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComboItem" ADD CONSTRAINT "ComboItem_productoId_fkey"
    FOREIGN KEY ("productoId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
