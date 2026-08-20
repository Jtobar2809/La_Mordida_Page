-- Insumos que se descuentan a mano porque no pueden ir en una receta: al
-- cocinar una hamburguesa nadie sabe todavía si es para llevar o para comer en
-- el sitio, y la que se come en la mesa no usa bolsa.
ALTER TABLE "Insumo" ADD COLUMN "consumoManual" BOOLEAN NOT NULL DEFAULT false;

-- Se marcan los desechables que hoy no baja ninguna receta.
UPDATE "Insumo" SET "consumoManual" = true WHERE "nombre" IN (
  'Bolsa de papel grande',
  'Bolsa parafinada',
  'Bolsa hermética grande',
  'Bolsa de basura',
  'Papel parafinado grande',
  'Papel parafinado pequeño',
  'Bandeja 7',
  'Caja de perro',
  'Copas de salsa',
  'Palillo de hamburguesa'
);
