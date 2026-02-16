"use client";

import { useState } from "react";
import { useTRPC, useTRPCClient } from "~/trpc/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-800",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    HIGH: "bg-orange-100 text-orange-800",
    CRITICAL: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[severity] ?? "bg-gray-100 text-gray-800"}`}
    >
      {severity}
    </span>
  );
}

export default function CatalogHealthPage() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const [selectedRetailerId, setSelectedRetailerId] = useState("");
  const [running, setRunning] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    overallScore: number;
    totalProducts: number;
    issuesFound: number;
    breakdown: {
      staleProducts: number;
      missingFields: number;
      pricingIssues: number;
    };
  } | null>(null);

  // Fetch retailers for dropdown
  const retailers = useQuery(
    trpc.admin.listRetailers.queryOptions({
      limit: 100,
      status: "APPROVED",
    }),
  );

  // Fetch catalog issues platform-wide (admin view)
  const issues = useQuery(
    trpc.admin.listAllCatalogIssues.queryOptions({
      limit: 50,
      resolved: false,
    }),
  );

  async function handleRunHealthCheck() {
    if (!selectedRetailerId) return;
    setRunning(true);
    setLastResult(null);
    try {
      const result = await client.admin.triggerCatalogHealthCheck.mutate({
        retailerId: selectedRetailerId,
      });
      setLastResult(result);
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to run health check",
      );
    } finally {
      setRunning(false);
    }
  }

  async function handleResolveIssue(issueId: string) {
    setResolving(issueId);
    try {
      await client.admin.resolveCatalogIssue.mutate({
        issueId,
        resolution: "Manually resolved by admin",
      });
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resolve issue");
    } finally {
      setResolving(null);
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catalog Health</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor product catalog quality across retailers
        </p>
      </div>

      {/* Run Health Check */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Run Health Check
        </h2>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">
              Select Retailer
            </label>
            <select
              value={selectedRetailerId}
              onChange={(e) => setSelectedRetailerId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Choose a retailer...</option>
              {retailers.data?.items.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.companyName} ({r._count.products} products)
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRunHealthCheck}
            disabled={running || !selectedRetailerId}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? "Running..." : "Run Health Check"}
          </button>
        </div>
      </div>

      {/* Health Check Results */}
      {lastResult && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Latest Health Check Results
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <div className="rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-500">Overall Score</p>
              <p
                className={`mt-1 text-3xl font-bold ${getScoreColor(lastResult.overallScore)}`}
              >
                {lastResult.overallScore}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-500">Total Products</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {lastResult.totalProducts}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-500">Stale Stock</p>
              <p className="mt-1 text-2xl font-bold text-orange-600">
                {lastResult.breakdown.staleProducts}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-500">Missing Fields</p>
              <p className="mt-1 text-2xl font-bold text-yellow-600">
                {lastResult.breakdown.missingFields}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4 text-center">
              <p className="text-sm text-gray-500">Pricing Issues</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {lastResult.breakdown.pricingIssues}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Open Catalog Issues */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Open Catalog Issues
          </h2>
          <p className="text-sm text-gray-500">
            Issues detected across all retailer catalogs
          </p>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Severity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Recommendation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {issues.isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  Loading issues...
                </td>
              </tr>
            )}
            {issues.data?.items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  No open catalog issues
                </td>
              </tr>
            )}
            {issues.data?.items.map((issue) => (
              <tr key={issue.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {issue.issueType.replace(/_/g, " ")}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <SeverityBadge severity={issue.severity} />
                </td>
                <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-900">
                  {issue.description}
                </td>
                <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-500">
                  {issue.recommendation ?? "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {new Date(issue.createdAt).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <button
                    onClick={() => handleResolveIssue(issue.id)}
                    disabled={resolving === issue.id}
                    className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {resolving === issue.id ? "Resolving..." : "Resolve"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
