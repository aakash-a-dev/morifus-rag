import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Document Intelligence",
  description: "Create a workspace, upload documents, ask questions, and surface contradictions across your sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">{children}</main>
        </div>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
