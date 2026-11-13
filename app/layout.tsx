import "./globals.css";
import BoneyardProvider from "./components/BoneyardProvider";
import ClientThemeProvider from "./components/ClientThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <body>
        <ClientThemeProvider>
          <BoneyardProvider>{children}</BoneyardProvider>
        </ClientThemeProvider>
      </body>
    </html>
  );
}
