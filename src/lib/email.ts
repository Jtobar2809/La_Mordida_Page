import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "La Mordida <onboarding@resend.dev>";

function wrapTemplate(title: string, bodyHtml: string) {
  return `
  <div style="background-color:#1B1712;padding:40px 20px;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background-color:#FBF6EE;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#E85C2B,#F0A93A);padding:28px 32px;">
        <p style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:0.05em;">LA MORDIDA</p>
      </div>
      <div style="padding:32px;color:#1B1712;">
        <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
        ${bodyHtml}
      </div>
      <div style="padding:20px 32px;background-color:#F5F3F0;color:#7A6C58;font-size:12px;">
        © ${new Date().getFullYear()} La Mordida. Si no solicitaste este correo, puedes ignorarlo.
      </div>
    </div>
  </div>`;
}

/**
 * Envía el correo de recuperación de contraseña. Si no hay RESEND_API_KEY
 * configurada (ej. en desarrollo local sin cuenta de Resend), el enlace se
 * registra en el log del servidor para poder seguir probando el flujo.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const html = wrapTemplate(
    "Recupera tu contraseña",
    `
      <p style="color:#4E4436;line-height:1.6;">Recibimos una solicitud para restablecer tu contraseña. Este enlace es válido por 30 minutos.</p>
      <a href="${resetUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:linear-gradient(135deg,#E85C2B,#F0A93A);color:#fff;text-decoration:none;border-radius:999px;font-weight:700;">Crear nueva contraseña</a>
      <p style="color:#A99C88;font-size:12px;margin-top:24px;">Si el botón no funciona, copia y pega este enlace: <br/>${resetUrl}</p>
    `
  );

  if (!resend) {
    if (process.env.NODE_ENV === "development") console.debug(`[email:dev] Recuperar contraseña para ${to}: ${resetUrl}`);
    return { sent: false, reason: "RESEND_API_KEY no configurada (modo desarrollo)" };
  }

  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject: "Recupera tu contraseña — La Mordida", html });
    if (error) {
      console.error("[email] Resend rechazó el envío:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] Error enviando correo de recuperación:", err);
    return { sent: false, reason: "Error del proveedor de correo" };
  }
}

/** Correo de bienvenida al registrarse (opcional, se puede invocar desde events.createUser / registerUser) */
export async function sendWelcomeEmail(to: string, name: string) {
  const html = wrapTemplate(
    `¡Bienvenido, ${name.split(" ")[0]}!`,
    `
      <p style="color:#4E4436;line-height:1.6;">Tu cuenta ya está lista. Pide en caja, escanea tu código QR después de cada compra y junta sellos en tu tarjeta digital.</p>
      <p style="color:#4E4436;line-height:1.6;">Al completar 7 sellos, te regalamos una hamburguesa gratis.</p>
    `
  );

  if (!resend) {
    if (process.env.NODE_ENV === "development") console.debug(`[email:dev] Bienvenida para ${to}`);
    return { sent: false };
  }

  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject: "¡Bienvenido a La Mordida! 🔥", html });
    if (error) {
      console.error("[email] Resend rechazó el envío:", error);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] Error enviando correo de bienvenida:", err);
    return { sent: false };
  }
}
