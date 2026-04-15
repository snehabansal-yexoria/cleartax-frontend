import "./globals.css";
import BoneyardProvider from "./components/BoneyardProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <BoneyardProvider>{children}</BoneyardProvider>
      </body>
    </html>
  );
}
