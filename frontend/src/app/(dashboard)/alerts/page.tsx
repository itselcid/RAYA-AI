"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Thermometer,
  Activity,
  Pill,
  Phone,
  Loader2,
} from "lucide-react";
import { alertsApi, patientsApi } from "@/lib/api";

interface Alert {
  id: string;
  patient_id: string;
  patient_name: string;
  severity: string;
  alert_type: string;
  title: string;
  description: string;
  is_resolved: boolean;
  created_at: string;
}

const severityConfig: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  critical: { bg: "bg-error-light", text: "text-error", dot: "bg-error", border: "border-error/20" },
  high: { bg: "bg-error-light", text: "text-error", dot: "bg-error", border: "border-error/20" },
  medium: { bg: "bg-warning-light", text: "text-warning", dot: "bg-warning", border: "border-warning/20" },
  low: { bg: "bg-success-light", text: "text-success", dot: "bg-success", border: "border-success/20" },
};

function getIcon(alertType: string) {
  if (alertType.includes("blood") || alertType.includes("sugar") || alertType.includes("pressure")) return Thermometer;
  if (alertType.includes("medication") || alertType.includes("adherence")) return Pill;
  if (alertType.includes("missed") || alertType.includes("call")) return Phone;
  return Activity;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export default function AlertsPage() {
  const [filter, setFilter] = useState<string>("all");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([alertsApi.list(), patientsApi.list()])
      .then(([alertsRes, patientsRes]) => {
        const patientMap: Record<string, string> = {};
        (patientsRes.data || []).forEach((p: any) => {
          patientMap[p.id] = p.name;
        });

        const mapped: Alert[] = (alertsRes.data || []).map((a: any) => ({
          id: a.id,
          patient_id: a.patient_id,
          patient_name: patientMap[a.patient_id] || "Unknown Patient",
          severity: a.severity || "medium",
          alert_type: a.alert_type || "",
          title: a.title || a.description || "Alert",
          description: a.description || "",
          is_resolved: a.is_resolved || false,
          created_at: a.created_at,
        }));

        // Sort by most recent first
        mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setAlerts(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = alerts.filter((a) => {
    if (filter === "resolved") return a.is_resolved;
    if (filter === "unresolved") return !a.is_resolved;
    if (filter === "all") return true;
    return a.severity === filter;
  });

  const resolve = async (id: string) => {
    try {
      await alertsApi.update(id, { is_resolved: true });
      setAlerts(alerts.map((a) => (a.id === id ? { ...a, is_resolved: true } : a)));
    } catch {
      // Still update locally for responsiveness
      setAlerts(alerts.map((a) => (a.id === id ? { ...a, is_resolved: true } : a)));
    }
  };

  const unresolvedCount = alerts.filter((a) => !a.is_resolved).length;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between h-[68px] px-8 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">Alerts</h1>
          {unresolvedCount > 0 && (
            <span className="text-xs font-bold text-white bg-error px-2.5 py-0.5 rounded-full animate-pulse">
              {unresolvedCount} active
            </span>
          )}
        </div>
        <span className="text-xs text-text-tertiary">
          {alerts.length > 0 ? "Live from database" : ""}
        </span>
      </header>

      <div className="flex items-center gap-2 px-8 py-4">
        {["all", "unresolved", "critical", "high", "medium", "low", "resolved"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 px-3.5 rounded-full text-xs font-medium transition-colors capitalize ${
              filter === f
                ? "bg-accent text-white"
                : "bg-card border border-border text-text-secondary hover:bg-background"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 px-8 pb-8 overflow-y-auto space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="w-10 h-10 text-text-tertiary mb-3" />
            <p className="text-sm text-text-tertiary">
              {filter === "all" ? "No alerts yet. Run a call simulation to generate alerts!" : `No ${filter} alerts`}
            </p>
          </div>
        ) : filtered.map((alert) => {
          const config = severityConfig[alert.severity] || severityConfig.medium;
          const Icon = getIcon(alert.alert_type);
          return (
            <div
              key={alert.id}
              className={`flex items-center gap-4 p-4 rounded-xl bg-card border ${
                alert.is_resolved ? "border-border opacity-60" : config.border
              }`}
            >
              <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${config.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-text-primary">{alert.patient_name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-sm text-text-secondary">{alert.title}</p>
                {alert.description && alert.description !== alert.title && (
                  <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{alert.description}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <Clock className="w-3 h-3 text-text-tertiary" />
                  <span className="text-xs text-text-tertiary">{timeAgo(alert.created_at)}</span>
                </div>
              </div>
              {!alert.is_resolved ? (
                <button
                  onClick={() => resolve(alert.id)}
                  className="h-8 px-3.5 rounded-lg bg-success text-white text-xs font-medium flex items-center gap-1.5 hover:bg-success/90 transition-colors shrink-0"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Resolve
                </button>
              ) : (
                <span className="text-xs text-text-tertiary flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-success" /> Resolved
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
