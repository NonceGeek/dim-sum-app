"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Database, CheckCircle, ListChecks } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalCorpusEntries: number;
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading: loading } = useQuery<DashboardStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats");

      if (!response.ok) {
        throw new Error("Failed to fetch statistics");
      }

      return response.json();
    },
  });

  const statCards = [
    {
      title: "Total Users",
      value: stats?.totalUsers?.toLocaleString() || "0",
      icon: Users,
      description: "Registered users",
      href: "/admin/users",
    },
    {
      title: "Corpus Entries",
      value: stats?.totalCorpusEntries?.toLocaleString() || "0",
      icon: Database,
      description: "Total corpus data entries",
      href: "/admin/corpus",
    },
  ];

  const quickActions = [
    {
      title: "Manage Users",
      description: "View and manage user accounts",
      href: "/admin/users",
      icon: Users,
    },
    {
      title: "Corpus Data",
      description: "Manage language corpus entries",
      href: "/admin/corpus",
      icon: Database,
    },
    {
      title: "Rule Ops",
      description: "Compile rules and trigger Agent runs",
      href: "/admin/rules",
      icon: ListChecks,
    },
    {
      title: "System Settings",
      description: "Configure system parameters",
      href: "/admin/settings",
      icon: CheckCircle,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="bg-gray-800 border-gray-700">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-20 bg-gray-600 rounded animate-pulse" />
                <div className="h-4 w-4 bg-gray-600 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-gray-600 rounded animate-pulse mb-1" />
                <div className="h-3 w-24 bg-gray-600 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Dashboard
        </h2>
        <p className="text-gray-400 mt-2">
          Welcome to the admin panel. Here's an overview of your system.
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer"
            >
              <Link href={card.href}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-200">
                    {card.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-gray-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {card.value}
                  </div>
                  <p className="text-xs text-gray-400">{card.description}</p>
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-white">Quick Actions</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.title}
                className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-5 w-5 text-purple-400" />
                    <CardTitle className="text-base text-white">
                      {action.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-sm text-gray-400">
                    {action.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    asChild
                    size="sm"
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <Link href={action.href}>Open</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
