import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(160deg, #1B1712 0%, #332B21 100%)",
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", color: "#E85C2B", fontSize: 28, fontWeight: 700, letterSpacing: "0.2em" }}>
          100% ARTESANAL
        </div>
        <div style={{ display: "flex", color: "white", fontSize: 96, fontWeight: 900, lineHeight: 1, marginTop: 20 }}>
          LA MORDIDA
        </div>
        <div style={{ display: "flex", color: "#CFC5B8", fontSize: 32, marginTop: 24, maxWidth: 800 }}>
          Hamburguesas y perros calientes artesanales. Pide en línea y gana puntos con cada mordida.
        </div>
      </div>
    ),
    { ...size }
  );
}
