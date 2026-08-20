-- Reglas de cobro tipo 2x1 / 3x2 / la segunda a mitad.
-- No son productos: un 2x1 no va en la carta con precio propio, se aplica al
-- momento de cobrar. Un combo sí es un producto, y por eso vive en ComboItem.
CREATE TABLE "PromocionRegla" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "entregadas" INTEGER NOT NULL,
    -- Float porque "la segunda a mitad" son 1,5 unidades pagadas.
    "pagadas" DOUBLE PRECISION NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "desde" TIMESTAMP(3),
    "hasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromocionRegla_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromocionRegla_productId_idx" ON "PromocionRegla"("productId");
CREATE INDEX "PromocionRegla_activa_idx" ON "PromocionRegla"("activa");

-- Borrar el producto se lleva sus promociones: una regla que apunta a un
-- producto que ya no existe no puede aplicarse a nada.
ALTER TABLE "PromocionRegla" ADD CONSTRAINT "PromocionRegla_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
