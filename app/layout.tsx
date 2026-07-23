import "./globals.css";
import BoneyardProvider from "./components/BoneyardProvider";
import { ThemeProvider } from "next-themes";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <BoneyardProvider>{children}</BoneyardProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
