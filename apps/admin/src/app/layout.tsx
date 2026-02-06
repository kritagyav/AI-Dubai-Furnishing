import type { Metadata } from "next";

import "./styles.css";

export const metadata: Metadata = {
  title: "Dubai Furnishing - Admin",
  description: "Admin, Support, Retailer & Corporate Portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
