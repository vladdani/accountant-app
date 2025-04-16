import { Geist } from "next/font/google";
import "./globals.css";
import TopBar from '../components/TopBar';
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import { MainContentWrapper } from "@/components/layout/main-content-wrapper";

const geist = Geist({ subsets: ['latin'] });

// Metadata export is valid again in a Server Component
export const metadata = {
  title: 'CariNota',
  description: 'Smart Document Management for Indonesian Accountants',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geist.className} flex flex-col min-h-screen`}>
        <Providers>
            <Analytics mode="auto" />
            <TopBar />
            <MainContentWrapper>{children}</MainContentWrapper>
        </Providers>
      </body>
    </html>
  );
}
