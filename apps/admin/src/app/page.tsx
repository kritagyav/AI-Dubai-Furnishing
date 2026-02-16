import Link from "next/link";

const sections = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Platform overview, KPIs, and real-time metrics",
    stat: "Overview",
  },
  {
    title: "Retailer Management",
    href: "/retailer",
    description:
      "Approve applications, manage retailers, monitor catalog health",
    stat: "Retailers",
  },
  {
    title: "Order Management",
    href: "/orders",
    description: "View and manage customer orders, process refunds",
    stat: "Orders",
  },
  {
    title: "Delivery Operations",
    href: "/deliveries",
    description: "Schedule slots, track deliveries, resolve issues",
    stat: "Deliveries",
  },
  {
    title: "Support Center",
    href: "/support",
    description: "Manage tickets, assign agents, track resolution",
    stat: "Tickets",
  },
  {
    title: "Corporate Accounts",
    href: "/corporate",
    description: "Manage B2B accounts, employee access, corporate discounts",
    stat: "Accounts",
  },
];

export default function AdminHomePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Portal</h1>
        <p className="mt-2 text-gray-600">
          Manage the Dubai AI Furnishing Platform
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                {section.title}
              </h2>
              <span className="text-sm text-gray-400">&rarr;</span>
            </div>
            <p className="mt-2 text-sm text-gray-500">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
