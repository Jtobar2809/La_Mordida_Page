import { describe, it, expect } from "vitest";
import { mensajeDeEspera, LIMITES } from "./rate-limit";

describe("mensajeDeEspera", () => {
  it("dice segundos cuando falta poco", () => {
    expect(mensajeDeEspera(30)).toBe("Intenta de nuevo en 30 segundos.");
  });

  it("dice 'un minuto' en el tramo intermedio, no '1 minutos'", () => {
    expect(mensajeDeEspera(90)).toBe("Intenta de nuevo en un minuto.");
  });

  it("redondea hacia arriba en minutos para no prometer de menos", () => {
    // 3597s son 59,95 minutos: decir "59" haría reintentar antes de tiempo.
    expect(mensajeDeEspera(3597)).toBe("Intenta de nuevo en 60 minutos.");
  });
});

describe("LIMITES", () => {
  it("el tope por correo de recuperar contraseña es más estricto que el de IP", () => {
    // Si fuera al revés, el freno por correo nunca actuaría: la IP bloquearía
    // primero y bastaría rotar direcciones para bombardear un solo buzón.
    expect(LIMITES.resetPorCorreo.limite).toBeLessThan(LIMITES.resetPorIp.limite);
  });

  it("todos los topes son positivos y con ventana real", () => {
    // Un límite en 0 bloquearía a todo el mundo desde el primer intento.
    for (const [nombre, { limite, ventana }] of Object.entries(LIMITES)) {
      expect(limite, nombre).toBeGreaterThan(0);
      expect(ventana, nombre).toBeGreaterThan(0);
    }
  });

  it("el login deja margen para el que se equivoca de verdad", () => {
    // Menos de 5 intentos castiga a la persona distraída más que al atacante.
    expect(LIMITES.login.limite).toBeGreaterThanOrEqual(5);
  });
});
