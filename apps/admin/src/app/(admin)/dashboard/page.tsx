function StatCard({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {change && (
        <p className="mt-1 text-sm text-green-600">{change}</p>
      )}
    </div>
  );
}

function ActivityItem({
  action,
  detail,
  time,
}: {
  action: string;
  detail: string;
  time: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{action}</p>
        <p className="text-xs text-gray-500">{detail}</p>
      </div>
      <span className="text-xs text-gray-400">{time}</span>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Platform Dashboard
      </h1>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Orders" value="--" change="Connect API" />
        <StatCard label="Revenue (AED)" value="--" change="Connect API" />
        <StatCard label="Active Retailers" value="--" />
        <StatCard label="Open Tickets" value="--" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Recent Orders
          </h2>
          <div className="text-sm text-gray-500">
            <ActivityItem
              action="Order placed"
              detail="Connect tRPC to see live data"
              time="--"
            />
            <p className="py-4 text-center text-gray-400">
              API integration pending
            </p>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Pending Approvals
          </h2>
          <div className="space-y-3">
            <ActivityItem
              action="Retailer Applications"
              detail="Review and approve new retailers"
              time="--"
            />
            <ActivityItem
              action="Product Validation"
              detail="Validate new product listings"
              time="--"
            />
          </div>
        </div>

        {/* Platform Health */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Platform Health
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">API</span>
              <span className="font-medium text-green-600">Operational</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Database</span>
              <span className="font-medium text-green-600">Operational</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Worker</span>
              <span className="font-medium text-green-600">Running</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">AI Service</span>
              <span className="font-medium text-yellow-600">Standby</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button className="rounded-md bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
              Review Retailers
            </button>
            <button className="rounded-md bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100">
              Create Slots
            </button>
            <button className="rounded-md bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100">
              View Reports
            </button>
            <button className="rounded-md bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100">
              Manage Users
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
