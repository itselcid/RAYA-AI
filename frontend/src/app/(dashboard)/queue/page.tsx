"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Phone,
  PhoneCall,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Timer,
  RefreshCw,
  Play,
  ArrowRight,
  Activity,
  Users,
} from "lucide-react";
import { patientsApi } from "@/lib/api";

interface QueueItem {
  patient_id: string;
  patient_name: string;
  phone: string;
  condition: string;
  call_frequency: string;
  call_time: string;
  scheduled_at: string;
  status: "scheduled" | "ready" | "overdue" | "completed";
  risk_score: number | null;
  review_status: string | null;
  call_id: string | null;
  question_count: number;
  patient_status: string;
}

interface QueueData {
  date: string;
  total: number;
  pending: number;
  completed: number;
  queue: QueueItem[];
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  overdue: { label: "Overdue", color: "text-red-600", bg: "bg-red-50 border-red-200", icon: AlertTriangle },
  ready: { label: "Ready Now", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: PhoneCall },
  scheduled: { label: "Scheduled", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: Clock },
  completed: { label: "Completed", color: "text-green-600", bg: "bg-green-50 border-green-200", icon: CheckCircle2 },
};

const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  every_3_days: "Every 3 days",
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

export default function CallQueuePage() {
  const router = useRouter();
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const loadQueue = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await patientsApi.queue();
      setData(res.data);
    } catch (err: any) {
      console.error("Failed to load queue:", err);
      if (err.response?.status === 401) window.location.href = "/";
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => loadQueue(true), 60000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  const filtered = data?.queue.filter((q) => filter === "all" || q.status === filter) || [];

  const startCall = (patientId: string) => {
    // Navigate to simulator with patient pre-selected
    router.push(`/simulate?patient=${patientId}`);
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between h-[68px] px-8 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <CalendarClock className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-bold text-text-primary">Call Queue</h1>
          <span className="text-sm text-text-tertiary bg-background px-2.5 py-0.5 rounded-full">{dateStr}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">{timeStr}</span>
          <button
            onClick={() => loadQueue(true)}
            disabled={refreshing}
            className="flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm font-medium text-text-secondary hover:bg-background transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      {data && (
        <div className="flex items-center gap-4 px-8 py-4 border-b border-border bg-background/50">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary">{data.total}</p>
                <p className="text-[10px] text-text-tertiary uppercase">Total Today</p>
              </div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Timer className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600">{data.pending}</p>
                <p className="text-[10px] text-text-tertiary uppercase">Pending</p>
              </div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{data.completed}</p>
                <p className="text-[10px] text-text-tertiary uppercase">Completed</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex-1 ml-6">
            <div className="flex items-center justify-between text-[10px] text-text-tertiary mb-1">
              <span>Today&apos;s Progress</span>
              <span>{data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-green-500 transition-all duration-500"
                style={{ width: `${data.total > 0 ? (data.completed / data.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 px-8 py-3">
        {[
          { key: "all", label: "All", count: data?.total },
          { key: "overdue", label: "Overdue", count: data?.queue.filter((q) => q.status === "overdue").length },
          { key: "ready", label: "Ready", count: data?.queue.filter((q) => q.status === "ready").length },
          { key: "scheduled", label: "Scheduled", count: data?.queue.filter((q) => q.status === "scheduled").length },
          { key: "completed", label: "Completed", count: data?.completed },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`h-8 px-3 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filter === f.key ? "bg-accent text-white" : "bg-card border border-border text-text-secondary hover:bg-background"
            }`}>
            {f.label}
            {(f.count ?? 0) > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === f.key ? "bg-white/20" : "bg-background"}`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Queue List */}
      <div className="flex-1 px-8 pb-8 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
              <p className="text-sm text-text-secondary">Loading call queue...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <CalendarClock className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
              <p className="font-medium text-text-secondary">No calls {filter !== "all" ? `with status "${filter}"` : "scheduled for today"}</p>
              <p className="text-xs text-text-tertiary mt-1">Check back later or adjust patient schedules</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => {
              const cfg = statusConfig[item.status];
              const StatusIcon = cfg.icon;
              return (
                <div key={item.patient_id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-sm ${cfg.bg}`}>
                  {/* Status Icon */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                    item.status === "overdue" ? "bg-red-100" :
                    item.status === "ready" ? "bg-amber-100" :
                    item.status === "completed" ? "bg-green-100" :
                    "bg-blue-100"
                  }`}>
                    <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
                  </div>

                  {/* Patient Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text-primary text-sm">{item.patient_name}</p>
                      {item.patient_status === "at_risk" && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">AT RISK</span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">{item.condition}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-tertiary">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{item.phone}</span>
                      <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{item.question_count} questions</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{frequencyLabels[item.call_frequency]}</span>
                    </div>
                  </div>

                  {/* Scheduled Time */}
                  <div className="text-center shrink-0 w-20">
                    <p className="text-lg font-bold text-text-primary">{item.call_time}</p>
                    <p className={`text-[10px] font-semibold uppercase ${cfg.color}`}>{cfg.label}</p>
                  </div>

                  {/* Risk Score (if completed) */}
                  {item.status === "completed" && item.risk_score !== null && (
                    <div className="text-center shrink-0 w-16">
                      <p className={`text-sm font-bold ${
                        item.risk_score > 0.7 ? "text-red-600" :
                        item.risk_score > 0.4 ? "text-amber-600" :
                        "text-green-600"
                      }`}>
                        {Math.round(item.risk_score * 100)}%
                      </p>
                      <p className="text-[10px] text-text-tertiary">Risk</p>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="shrink-0">
                    {item.status === "completed" ? (
                      <button
                        onClick={() => router.push(`/calls`)}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-green-300 text-green-700 text-xs font-medium hover:bg-green-50 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> View Report
                      </button>
                    ) : (
                      <button
                        onClick={() => startCall(item.patient_id)}
                        className={`flex items-center gap-1.5 h-9 px-4 rounded-lg text-white text-xs font-medium transition-colors ${
                          item.status === "overdue"
                            ? "bg-red-500 hover:bg-red-600"
                            : item.status === "ready"
                            ? "bg-amber-500 hover:bg-amber-600"
                            : "bg-accent hover:bg-accent-hover"
                        }`}
                      >
                        <Play className="w-3.5 h-3.5" /> Start Call
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
