import { ImageResponse } from "next/og";
export const alt = "FutureFlow — Website monitoring and event automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: 80,
        background: "#f7f8f3",
        color: "#193c30",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 30, marginBottom: 48 }}>futureflow.</div>
      <div style={{ fontSize: 76, fontWeight: 700 }}>Less watching.</div>
      <div style={{ fontSize: 76, color: "#4c7860" }}>More moving forward.</div>
      <div style={{ fontSize: 27, marginTop: 40 }}>
        Website monitoring · Webhooks · Deadline reminders
      </div>
    </div>,
    size,
  );
}
