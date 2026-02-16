"use client";

/**
 * Dashboard -- main landing for authenticated users.
 * Redirects to onboarding if the user hasn't selected a path yet.
 * Shows recent orders, project count, quick stats, and navigation cards.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

interface RecentOrder {
  id: string;
  orderRef: string;
  status: string;
  totalFils: number;
  createdAt: Date;
  _count: { lineItems: number };
}

interface ProjectListItem {
  id: string;
  name: string;
  updatedAt: Date;
  _count: { rooms: number };
}

const ORDER_STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-gray-100 text-gray-800",
  DRAFT: "bg-gray-100 text-gray-800",
};

export default function DashboardPage() {
  const client = useTRPCClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [onboardingPath, setOnboardingPath] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalSpentFils, setTotalSpentFils] = useState(0);

  useEffect(() => {
    void client.user.getOnboardingStatus
      .query()
      .then((status) => {
        if (status.needsOnboarding) {
          router.replace("/onboarding");
          return;
        }
        setOnboardingPath(status.path);

        // Load dashboard data in parallel
        const ordersPromise = client.commerce.listOrders
          .query({ limit: 3 })
          .then((data) => {
            const items = data.items as RecentOrder[];
            setRecentOrders(items);
            // Also get total count with a larger query
            return client.commerce.listOrders.query({ limit: 100 });
          })
          .then((allOrders) => {
            const allItems = allOrders.items as RecentOrder[];
            setTotalOrders(allItems.length);
            const spent = allItems
              .filter((o) => o.status === "PAID" || o.status === "DELIVERED" || o.status === "SHIPPED" || o.status === "PROCESSING")
              .reduce((sum, o) => sum + o.totalFils, 0);
            setTotalSpentFils(spent);
          })
          .catch(() => {
            // Non-critical
          });

        const projectsPromise = client.room.listProjects
          .query({ limit: 50 })
          .then((data) => {
            setProjects(data.items as ProjectListItem[]);
          })
          .catch(() => {
            // Non-critical
          });

        void Promise.allSettled([ordersPromise, projectsPromise]).then(() => {
          setLoading(false);
        });
      })
      .catch(() => {
        setLoading(false);
      });
  }, [client, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {onboardingPath === "FURNISH_NOW"
            ? "Ready to furnish your space. Start by adding a room."
            : "Explore styles and save ideas for when you're ready."}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Active Projects</p>
          <p className="text-2xl font-bold">{projects.length}</p>
        </div>
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Total Rooms</p>
          <p className="text-2xl font-bold">
            {projects.reduce((sum, p) => sum + p._count.rooms, 0)}
          </p>
        </div>
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Total Orders</p>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </div>
        <div className="border-border rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Total Spent</p>
          <p className="text-2xl font-bold">
            AED{" "}
            {(totalSpentFils / 100).toLocaleString("en-AE", {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* Recent Orders */}
      {recentOrders.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Orders</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/orders")}
            >
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="border-border flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">Order #{order.orderRef}</p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(order.createdAt).toLocaleDateString()} &middot;{" "}
                    {order._count.lineItems} item
                    {order._count.lineItems !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">
                    AED{" "}
                    {(order.totalFils / 100).toLocaleString("en-AE", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      ORDER_STATUS_STYLES[order.status] ??
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your Projects */}
      {projects.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Your Projects ({projects.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/projects")}
            >
              View All
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 3).map((proj) => (
              <button
                key={proj.id}
                onClick={() => router.push(`/projects/${proj.id}`)}
                className="border-border rounded-lg border p-4 text-left transition hover:shadow-md"
              >
                <p className="font-medium">{proj.name}</p>
                <p className="text-muted-foreground text-xs">
                  {proj._count.rooms} room{proj._count.rooms !== 1 ? "s" : ""}{" "}
                  &middot; Updated{" "}
                  {new Date(proj.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Cards */}
      {onboardingPath === "FURNISH_NOW" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="New Project"
            description="Start furnishing a new apartment"
            action="Create project"
            onClick={() => router.push("/projects/new")}
          />
          <DashboardCard
            title="My Projects"
            description="View and manage your furnishing projects"
            action="View projects"
            onClick={() => router.push("/projects")}
          />
          <DashboardCard
            title="Order History"
            description="Track deliveries and view past orders"
            action="View orders"
            onClick={() => router.push("/orders")}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Style Gallery"
            description="Browse completed apartments by style"
            action="Browse gallery"
            onClick={() => router.push("/gallery")}
          />
          <DashboardCard
            title="Saved Packages"
            description="Review packages you've saved"
            action="View saved"
            onClick={() => router.push("/saved")}
          />
          <DashboardCard
            title="Start Furnishing"
            description="Ready to furnish? Create your first project"
            action="Get started"
            onClick={() => router.push("/projects/new")}
          />
        </div>
      )}
    </div>
  );
}

function DashboardCard({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="border-border flex flex-col justify-between rounded-lg border p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={onClick}>
          {action}
        </Button>
      </div>
    </div>
  );
}
