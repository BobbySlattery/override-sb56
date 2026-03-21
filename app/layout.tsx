import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Override the Veto — Protect Ohio's THC Beverage Industry",
  description:
    "Contact your Ohio state legislators and urge them to override Governor DeWine's line-item veto of SB 56's THC beverage provisions.",
  openGraph: {
    title: "Override the Veto — Protect Ohio's THC Beverage Industry",
    description:
      "The votes exist. Leadership just needs to bring it to the floor. Contact your reps now.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
