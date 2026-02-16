"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Phone,
  TrendingUp,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  Loader2,
  Heart,
  Shield,
} from "lucide-react";
import { analyticsApi, patientsApi, callsApi, alertsApi } from "@/lib/api";

interface Stats {
  total_patients: number;
  active_patients: number;
  at_risk_patients: number;
  total_calls: number;
  completed_calls: number;
  avg_risk_score: number;
  unresolved_alerts: number;
  recovery_rate: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [conditionCounts, setConditionCounts] = useState<{ type: string; count: number }[]>([]);
  const [callsByDay, setCallsByDay] = useState<{ day: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.dashboard(),
      patientsApi.list(),
      callsApi.list(),
    ]).then(([statsRes, patientsRes, callsRes]) => {
      setStats(statsRes.data);

      // Count conditions from real patients
      const condMap: Record<string, number> = {};
      (patientsRes.data || []).forEach((p: any) => {
        const cond = p.condition || "Other";
        // Simplify condition names
        const key = cond.replace(/\s*\(.*?\)\s*/g, "").trim();
        condMap[key] = (condMap[key] || 0) + 1;
      });
      const conditions = Object.entries(condMap)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
      setConditionCounts(conditions);

      // Group calls by day of week
      const dayMap: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      (callsRes.data || []).forEach((c: any) => {
        if (c.started_at) {
          const d = new Date(c.started_at);
          const dayName = dayNames[d.getDay()];
          dayMap[dayName] = (dayMap[dayName] || 0) + 1;
        }
      });
      setCallsByDay(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => ({
        day,
        count: dayMap[day],
      })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  const s = stats || {
    total_patients: 0, active_patients: 0, at_risk_patients: 0,
    total_calls: 0, completed_calls: 0, avg_risk_score: 0,
    unresolved_alerts: 0, recovery_rate: 0,
  };

  const maxCalls = Math.max(...callsByDay.map(d => d.count), 1);
  const totalConditionPatients = conditionCounts.reduce((sum, c) => sum + c.count, 0) || 1;

  const kpis = [
    { label: "Total Patients", value: s.total_patients, icon: Users, color: "text-accent", bg: "bg-accent-light" },
    { label: "Active Patients", value: s.active_patients, icon: Heart, color: "text-success", bg: "bg-success-light" },
    { label: "At Risk", value: s.at_risk_patients, icon: AlertTriangle, color: "text-error", bg: "bg-error-light" },
    { label: "Total Calls", value: s.total_calls, icon: Phone, color: "text-info", bg: "bg-info-light" },
    { label: "Avg Risk Score", value: `${Math.round(s.avg_risk_score * 100)}%`, icon: Activity, color: s.avg_risk_score > 0.5 ? "text-error" : "text-success", bg: s.avg_risk_score > 0.5 ? "bg-error-light" : "bg-success-light" },
    { label: "Active Alerts", value: s.unresolved_alerts, icon: Shield, color: "text-warning", bg: "bg-warning-light" },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between h-[68px] px-8 bg-card border-b border-border shrink-0">
        <h1 className="text-xl font-bold text-text-primary">Analytics</h1>
        <span className="text-xs text-text-tertiary">Live from database</span>
      </header>

      <div className="flex-1 p-8 space-y-6 overflow-y-auto">
        {/* KPI Grid */}
        <div className="grid grid-cols-3 gap-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="bg-card rounded-xl border border-border p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xs text-text-secondary">{kpi.label}</p>
                  <span className="text-2xl font-bold text-text-primary">{kpi.value}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Calls by Day Chart */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-text-primary mb-4">Calls by Day</h3>
            {callsByDay.some(d => d.count > 0) ? (
              <div className="flex items-end gap-3 h-48">
                {callsByDay.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-text-primary">{d.count}</span>
                      <div
                        className="w-full rounded-t-md bg-accent/80"
                        style={{ height: `${Math.max((d.count / maxCalls) * 140, 4)}px` }}
                      />
                    </div>
                    <span className="text-xs text-text-tertiary">{d.day}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-text-tertiary">
                No call data yet. Run some simulations!
              </div>
            )}
          </div>

          {/* Patients by Condition */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-text-primary mb-4">Patients by Condition</h3>
            {conditionCounts.length > 0 ? (
              <div className="space-y-4">
                {conditionCounts.map((c) => {
                  const pct = Math.round((c.count / totalConditionPatients) * 100);
                  return (
                    <div key={c.type} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">{c.type}</span>
                        <span className="font-medium text-text-primary">{c.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-sm text-text-tertiary">
                No patient data yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
