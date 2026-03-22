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
    images: [
      {
        url: "/images/worker-1.jpg",
        width: 1200,
        height: 630,
        alt: "Override the Veto — Protect Ohio's THC Beverage Industry",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Override the Veto — Protect Ohio's THC Beverage Industry",
    description:
      "The votes exist. Leadership just needs to bring it to the floor. Contact your reps now.",
    images: ["/images/worker-1.jpg"],
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
