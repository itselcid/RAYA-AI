"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Phone,
  AlertTriangle,
  TrendingUp,
  Search,
  Bell,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Activity,
} from "lucide-react";
import { analyticsApi, callsApi, alertsApi, patientsApi } from "@/lib/api";

interface DashboardStats {
  total_patients: number;
  active_patients: number;
  at_risk_patients: number;
  total_calls: number;
  completed_calls: number;
  avg_risk_score: number;
  unresolved_alerts: number;
  recovery_rate: number;
}

interface CallData {
  id: string;
  patient_id: string;
  status: string;
  risk_score: number | null;
  started_at: string | null;
  duration_seconds: number | null;
  summary: string | null;
}

interface AlertData {
  id: string;
  patient_id: string;
  severity: string;
  title: string;
  is_resolved: boolean;
  created_at: string;
}

const riskColors: Record<string, string> = {
  low: "bg-success-light text-success",
  medium: "bg-warning-light text-warning",
  high: "bg-error-light text-error",
  critical: "bg-error text-white",
};

const statusColors: Record<string, string> = {
  completed: "bg-success",
  in_progress: "bg-info",
  scheduled: "bg-text-tertiary",
  failed: "bg-error",
};

function riskLabel(score: number | null): string {
  if (score === null || score === undefined) return "low";
  if (score >= 0.7) return "critical";
  if (score >= 0.5) return "high";
  if (score >= 0.3) return "medium";
  return "low";
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [userName, setUserName] = useState("Doctor");

  useEffect(() => {
    // Get user name
    const user = localStorage.getItem("raya_user");
    if (user) {
      try {
        setUserName(JSON.parse(user).name || "Doctor");
      } catch {}
    }

    // Fetch all data in parallel
    analyticsApi.dashboard().then((res) => setStats(res.data)).catch(() => {});

    // Fetch recent calls with patient info
    Promise.all([callsApi.list(), patientsApi.list()]).then(([callsRes, patientsRes]) => {
      const patients = patientsRes.data;
      const patientMap: Record<string, any> = {};
      patients.forEach((p: any) => { patientMap[p.id] = p; });

      const calls = (callsRes.data || [])
        .sort((a: CallData, b: CallData) => {
          const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
          const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 5)
        .map((c: CallData) => ({
          name: patientMap[c.patient_id]?.name || "Unknown",
          condition: patientMap[c.patient_id]?.condition || "—",
          status: c.status,
          risk: riskLabel(c.risk_score),
          time: timeAgo(c.started_at),
        }));
      setRecentCalls(calls);
    }).catch(() => {});

    // Fetch recent alerts with patient info
    Promise.all([alertsApi.list(), patientsApi.list()]).then(([alertsRes, patientsRes]) => {
      const patients = patientsRes.data;
      const patientMap: Record<string, any> = {};
      patients.forEach((p: any) => { patientMap[p.id] = p; });

      const alerts = (alertsRes.data || [])
        .filter((a: AlertData) => !a.is_resolved)
        .sort((a: AlertData, b: AlertData) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4)
        .map((a: AlertData) => ({
          name: patientMap[a.patient_id]?.name || "Unknown",
          condition: patientMap[a.patient_id]?.condition || "—",
          severity: a.severity,
          title: a.title,
          time: timeAgo(a.created_at),
        }));
      setRecentAlerts(alerts);
    }).catch(() => {});
  }, []);

  const displayStats = stats || {
    total_patients: 0,
    active_patients: 0,
    at_risk_patients: 0,
    total_calls: 0,
    completed_calls: 0,
    avg_risk_score: 0,
    unresolved_alerts: 0,
    recovery_rate: 0,
  };

  const statCards = [
    {
      label: "Active Patients",
      value: displayStats.active_patients,
      sub: `/${displayStats.total_patients}`,
      icon: Users,
      iconBg: "bg-accent-light",
      iconColor: "text-accent",
    },
    {
      label: "AI Calls Made",
      value: displayStats.total_calls,
      sub: `/${displayStats.completed_calls} completed`,
      icon: Phone,
      iconBg: "bg-info-light",
      iconColor: "text-info",
    },
    {
      label: "Active Alerts",
      value: displayStats.unresolved_alerts,
      sub: null,
      icon: AlertTriangle,
      iconBg: "bg-warning-light",
      iconColor: "text-warning",
    },
    {
      label: "Avg Risk Score",
      value: `${Math.round((displayStats.avg_risk_score || 0) * 100)}%`,
      sub: null,
      icon: Activity,
      iconBg: displayStats.avg_risk_score > 0.5 ? "bg-error-light" : "bg-success-light",
      iconColor: displayStats.avg_risk_score > 0.5 ? "text-error" : "text-success",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between h-[68px] px-8 bg-card border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-xs text-text-tertiary">Welcome back, {userName}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-white">
            <Search className="w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent text-sm outline-none w-48"
            />
          </div>
          <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-background transition-colors relative">
            <Bell className="w-4 h-4 text-text-secondary" />
            {(displayStats.unresolved_alerts > 0) && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-error text-white text-[10px] flex items-center justify-center font-bold">
                {displayStats.unresolved_alerts}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-8 space-y-6 overflow-y-auto">
        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-5">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-card rounded-xl border border-border p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-secondary">
                    {card.label}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}
                  >
                    <Icon className={`w-4 h-4 ${card.iconColor}`} />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-text-primary">
                    {card.value}
                  </span>
                  {card.sub && (
                    <span className="text-sm text-text-tertiary">
                      {card.sub}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Section: Recent Calls + Recent Alerts */}
        <div className="grid grid-cols-3 gap-5 min-h-0">
          {/* Recent AI Calls */}
          <div className="col-span-2 bg-card rounded-xl border border-border overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-text-primary">Recent AI Calls</h3>
              <span className="text-xs text-text-tertiary">
                {recentCalls.length > 0 ? "Live from database" : "No calls yet"}
              </span>
            </div>
            <div className="divide-y divide-border-light">
              {recentCalls.length > 0 ? recentCalls.map((call: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-background/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-accent-light flex items-center justify-center text-xs font-semibold text-accent shrink-0">
                    {call.name.split(" ").map((n: string) => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {call.name}
                    </p>
                    <p className="text-xs text-text-tertiary">{call.condition}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${statusColors[call.status] || "bg-text-tertiary"}`}
                    />
                    <span className="text-xs text-text-secondary capitalize">
                      {call.status.replace("_", " ")}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${riskColors[call.risk]}`}
                  >
                    {call.risk}
                  </span>
                  <span className="text-xs text-text-tertiary w-20 text-right">
                    {call.time}
                  </span>
                </div>
              )) : (
                <div className="px-5 py-8 text-center">
                  <Phone className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                  <p className="text-sm text-text-tertiary">No calls yet. Go to the Simulator to make your first AI call!</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-text-primary">Active Alerts</h3>
              <AlertTriangle className="w-4 h-4 text-warning" />
            </div>
            <div className="divide-y divide-border-light flex-1">
              {recentAlerts.length > 0 ? recentAlerts.map((alert: any, i: number) => (
                <div key={i} className="px-5 py-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text-primary">
                      {alert.name}
                    </p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      alert.severity === "critical" ? "bg-error text-white" :
                      alert.severity === "high" ? "bg-error-light text-error" :
                      "bg-warning-light text-warning"
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-1">{alert.title}</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-text-tertiary" />
                    <span className="text-xs text-text-tertiary">{alert.time}</span>
                  </div>
                </div>
              )) : (
                <div className="px-5 py-8 text-center">
                  <AlertTriangle className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                  <p className="text-sm text-text-tertiary">No active alerts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
