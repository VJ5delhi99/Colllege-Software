import "./globals.css";
import DemoBanner from "./demo-banner";
import Providers from "./providers";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <DemoBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
