/**
 * Set de íconos de ingredientes en SVG inline, usados en los minijuegos
 * en vez de emojis. Los emojis se renderizan distinto entre Windows/
 * macOS/Android (fuentes de emoji distintas), lo que hace que el juego
 * se vea inconsistente y "barato" según el dispositivo; estos íconos
 * son vectores propios con la paleta de marca, iguales en cualquier
 * pantalla.
 */

type IconProps = { className?: string };

export function IconBun({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6 30 Q4 12 24 10 Q44 12 42 30 Q42 36 24 36 Q6 36 6 30Z" fill="#E8C989" />
      <path d="M6 30 Q4 12 24 10 Q44 12 42 30" fill="none" stroke="#D9A15C" strokeWidth="1.5" opacity="0.5" />
      <circle cx="17" cy="20" r="1.6" fill="#FBF6EE" />
      <circle cx="24" cy="16" r="1.6" fill="#FBF6EE" />
      <circle cx="31" cy="20" r="1.6" fill="#FBF6EE" />
      <circle cx="20" cy="26" r="1.3" fill="#FBF6EE" opacity="0.8" />
      <circle cx="28" cy="26" r="1.3" fill="#FBF6EE" opacity="0.8" />
    </svg>
  );
}

export function IconCheese({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6 16 L42 24 L38 34 L4 30 Z" fill="#F0C94A" />
      <path d="M6 16 L42 24 L38 34 L4 30 Z" fill="none" stroke="#E28E1B" strokeWidth="1.2" opacity="0.4" />
      <circle cx="16" cy="23" r="1.8" fill="#E28E1B" opacity="0.5" />
      <circle cx="27" cy="27" r="1.5" fill="#E28E1B" opacity="0.5" />
    </svg>
  );
}

export function IconBacon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 14 Q20 22 8 30 Q20 38 34 32 Q42 28 40 18 Q28 12 8 14Z"
        fill="#C1544B"
      />
      <path d="M12 18 Q22 24 12 30" fill="none" stroke="#F5BE5C" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <path d="M20 16 Q30 24 20 32" fill="none" stroke="#F5BE5C" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <path d="M28 15 Q36 22 30 30" fill="none" stroke="#F5BE5C" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function IconTomato({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="26" r="16" fill="#D64545" />
      <circle cx="24" cy="26" r="16" fill="none" stroke="#9F361A" strokeWidth="1" opacity="0.3" />
      <path d="M18 12 Q24 6 30 12 Q26 10 24 13 Q22 10 18 12Z" fill="#5E7440" />
      <circle cx="18" cy="20" r="1.6" fill="#F6996E" opacity="0.7" />
      <circle cx="29" cy="30" r="1.4" fill="#F6996E" opacity="0.7" />
      <circle cx="22" cy="32" r="1.2" fill="#F6996E" opacity="0.6" />
    </svg>
  );
}

export function IconLettuce({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 26 Q6 14 16 12 Q18 6 26 8 Q34 6 38 14 Q44 16 42 26 Q40 34 24 34 Q8 34 6 26Z"
        fill="#8FAE68"
      />
      <path d="M14 26 Q18 16 24 26" fill="none" stroke="#5E7440" strokeWidth="1.5" opacity="0.6" />
      <path d="M24 26 Q28 16 34 26" fill="none" stroke="#5E7440" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

export function IconChili({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 10 Q16 8 18 12 L16 16" fill="none" stroke="#5E7440" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M16 15 Q10 22 12 30 Q14 38 24 38 Q34 36 34 26 Q34 16 16 15Z"
        fill="#E85C2B"
      />
      <path d="M16 15 Q10 22 12 30" fill="none" stroke="#C7451D" strokeWidth="1.2" opacity="0.4" />
    </svg>
  );
}

export function IconPatty({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="24" cy="26" rx="18" ry="10" fill="#6B3A2A" />
      <ellipse cx="24" cy="26" rx="18" ry="10" fill="none" stroke="#4A2A1F" strokeWidth="1" opacity="0.4" />
      <path d="M10 22 Q24 28 38 22" fill="none" stroke="#8C5A3F" strokeWidth="1.5" opacity="0.5" />
      <circle cx="16" cy="24" r="1.2" fill="#2A1712" opacity="0.5" />
      <circle cx="30" cy="28" r="1.2" fill="#2A1712" opacity="0.5" />
    </svg>
  );
}

export function IconBunDouble({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 32 Q3 22 14 20 Q13 10 24 9 Q35 10 34 20 Q45 22 44 32 Q44 37 24 37 Q4 37 4 32Z" fill="#D9A15C" />
      <path d="M4 32 Q3 22 14 20 Q13 10 24 9 Q35 10 34 20 Q45 22 44 32" fill="none" stroke="#BB7015" strokeWidth="1.5" opacity="0.5" />
      <circle cx="14" cy="22" r="1.5" fill="#FBF6EE" />
      <circle cx="24" cy="18" r="1.5" fill="#FBF6EE" />
      <circle cx="34" cy="22" r="1.5" fill="#FBF6EE" />
      <circle cx="19" cy="28" r="1.3" fill="#FBF6EE" opacity="0.8" />
      <circle cx="29" cy="28" r="1.3" fill="#FBF6EE" opacity="0.8" />
    </svg>
  );
}

export function IconBurgerComplete({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Pan superior */}
      <path d="M6 20 Q4 6 24 4 Q44 6 42 20 Q42 24 24 24 Q6 24 6 20Z" fill="#E8C989" />
      <circle cx="17" cy="12" r="1.3" fill="#FBF6EE" />
      <circle cx="24" cy="9" r="1.3" fill="#FBF6EE" />
      <circle cx="31" cy="12" r="1.3" fill="#FBF6EE" />
      {/* Lechuga */}
      <path d="M4 23 Q24 30 44 23 L42 27 Q24 33 6 27Z" fill="#8FAE68" />
      {/* Queso */}
      <path d="M5 27 L43 27 L40 32 L8 32Z" fill="#F0C94A" />
      {/* Carne */}
      <ellipse cx="24" cy="33" rx="19" ry="5" fill="#6B3A2A" />
      {/* Pan inferior */}
      <path d="M8 36 Q8 43 24 43 Q40 43 40 36 L40 34 L8 34Z" fill="#D9A15C" />
    </svg>
  );
}
