import type { Metadata } from "next";
import Link from "next/link";

import "./styles.css";

export const metadata: Metadata = {
  title: "Dubai Furnishing - Admin",
  description: "Admin, Support, Retailer & Corporate Portal",
};

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50">
        <nav className="bg-gray-900">
          <div className="mx-auto max-w-7xl px-4">
            <div className="flex h-14 items-center justify-between">
              <div className="flex items-center gap-1">
                <Link
                  href="/"
                  className="text-lg font-bold text-white"
                >
                  Dubai Furnishing
                </Link>
                <span className="ml-2 rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold text-black">
                  ADMIN
                </span>
              </div>
              <div className="flex items-center gap-1">
                <NavLink href="/dashboard">Dashboard</NavLink>
                <NavLink href="/retailer">Retailers</NavLink>
                <NavLink href="/orders">Orders</NavLink>
                <NavLink href="/deliveries">Deliveries</NavLink>
                <NavLink href="/support">Support</NavLink>
                <NavLink href="/corporate">Corporate</NavLink>
              </div>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
