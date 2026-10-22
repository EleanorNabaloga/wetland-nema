import "./globals.css";

export const metadata = {
  title: "Kuuma Obutonde: report pollution",
  description: "Take a photo of pollution in your environment. We record where you are. NEMA reviews it.",
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
