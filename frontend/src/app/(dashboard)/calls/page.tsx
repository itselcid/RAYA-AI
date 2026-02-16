"use client";

import { useState, useEffect } from "react";
import {
  Phone,
  Search,
  Clock,
  AlertTriangle,
  Bot,
  Languages,
  Globe,
  Loader2,
} from "lucide-react";
import { callsApi, patientsApi } from "@/lib/api";

interface CallMsg {
  id: string;
  role: string;
  content_darija: string;
  content_english: string | null;
  timestamp: string;
}

interface CallData {
  id: string;
  patient_id: string;
  patient_name: string;
  condition: string;
  status: string;
  risk_score: number | null;
  summary: string | null;
  detected_symptoms: any;
  duration_seconds: number | null;
  started_at: string | null;
  messages: CallMsg[];
}

const riskColors: Record<string, string> = {
  low: "bg-success-light text-success",
  medium: "bg-warning-light text-warning",
  high: "bg-error-light text-error",
  critical: "bg-error-light text-error",
};

const severityDot: Record<string, string> = {
  severe: "bg-error",
  high: "bg-error",
  moderate: "bg-warning",
  medium: "bg-warning",
  mild: "bg-success",
  low: "bg-success",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return isToday ? `Today, ${time}` : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

function getRiskLevel(score: number | null, symptoms: any): string {
  if (symptoms?.risk_level) return symptoms.risk_level;
  if (score === null) return "low";
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallData[]>([]);
  const [selected, setSelected] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [callsRes, patientsRes] = await Promise.all([
          callsApi.list(),
          patientsApi.list(),
        ]);
        const patientMap: Record<string, any> = {};
        for (const p of patientsRes.data) {
          patientMap[p.id] = p;
        }

        const enriched: CallData[] = callsRes.data.map((c: any) => ({
          ...c,
          patient_name: patientMap[c.patient_id]?.name || "Unknown",
          condition: patientMap[c.patient_id]?.condition || "",
        }));

        // Sort by most recent
        enriched.sort((a, b) => {
          const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
          const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
          return tb - ta;
        });

        setCalls(enriched);
        if (enriched.length > 0) setSelected(enriched[0]);
      } catch {
        // API failed — leave empty
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Phone className="w-12 h-12 text-text-tertiary" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">No calls yet</h2>
          <p className="text-sm text-text-secondary mt-1">
            Go to the Call Simulator to start an AI call, then come back here to see the transcript.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between h-[68px] px-8 bg-card border-b border-border shrink-0">
        <h1 className="text-xl font-bold text-text-primary">AI Calls</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">{calls.length} calls</span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Call List */}
        <div className="w-80 border-r border-border bg-card overflow-y-auto shrink-0">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-text-tertiary px-2">Call History</p>
          </div>
          {calls.map((call) => {
            const risk = getRiskLevel(call.risk_score, call.detected_symptoms);
            return (
              <button
                key={call.id}
                onClick={() => setSelected(call)}
                className={`w-full text-left px-4 py-3.5 border-b border-border-light hover:bg-background/50 transition-colors ${
                  selected?.id === call.id ? "bg-accent-light/50" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-text-primary truncate">{call.patient_name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2 ${riskColors[risk] || riskColors.low}`}>
                    {risk}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-tertiary">
                  <span className="truncate">{call.condition}</span>
                  <span>· {formatDuration(call.duration_seconds)}</span>
                </div>
                <p className="text-xs text-text-tertiary mt-1">{formatTime(call.started_at)}</p>
              </button>
            );
          })}
        </div>

        {/* Transcript View */}
        {selected && (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Patient Info Bar */}
            <div className="flex items-center gap-6 px-6 py-3 bg-card border-b border-border">
              <div className="w-10 h-10 rounded-full bg-accent-light flex items-center justify-center text-sm font-semibold text-accent">
                {selected.patient_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{selected.patient_name}</p>
                <p className="text-xs text-text-secondary">{selected.condition}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-xs text-text-secondary">Darija</span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-xs text-text-secondary">{formatDuration(selected.duration_seconds)}</span>
              </div>
            </div>

            {/* Chat */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-background">
              {selected.messages.length > 0 ? (
                selected.messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "patient" ? "justify-end" : ""}`}>
                    {msg.role === "ai" && (
                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={`max-w-lg space-y-1.5 ${msg.role === "patient" ? "items-end" : ""}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${msg.role === "ai" ? "text-accent" : "text-info"}`}>
                          {msg.role === "ai" ? "RAYA AI" : "Patient"}
                        </span>
                        <span className="text-xs text-text-tertiary">
                          {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "ai"
                            ? "bg-card rounded-tl-sm"
                            : "bg-info-light rounded-tr-sm"
                        }`}
                        dir={msg.role === "ai" ? "rtl" : "auto"}
                      >
                        {msg.content_darija}
                      </div>
                      {msg.content_english && (
                        <div className="flex items-center gap-1.5 px-1">
                          <Languages className="w-3 h-3 text-text-tertiary" />
                          <span className="text-xs italic text-text-tertiary">{msg.content_english}</span>
                        </div>
                      )}
                    </div>
                    {msg.role === "patient" && (
                      <div className="w-8 h-8 rounded-full bg-info-light flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-info">
                          {selected.patient_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
                  No transcript available for this call
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analysis Sidebar */}
        {selected && (
          <div className="w-72 border-l border-border bg-card overflow-y-auto shrink-0 p-5 space-y-5">
            <div>
              <h3 className="font-semibold text-text-primary mb-3">AI Analysis</h3>
              {(() => {
                const risk = getRiskLevel(selected.risk_score, selected.detected_symptoms);
                return (
                  <div className={`rounded-lg p-3 ${riskColors[risk] || riskColors.low}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold capitalize">
                        Risk: {risk} {selected.risk_score !== null && `(${Math.round(selected.risk_score * 100)}%)`}
                      </span>
                    </div>
                    <p className="text-xs opacity-80">{selected.summary || "No analysis available"}</p>
                  </div>
                );
              })()}
            </div>

            {selected.detected_symptoms?.symptoms?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-3">Detected Symptoms</h4>
                <div className="space-y-2.5">
                  {selected.detected_symptoms.symptoms.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${severityDot[s.severity] || severityDot.low}`} />
                      <span className="text-xs text-text-secondary">{s.symptom || s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question-by-question analysis (when available) */}
            {selected.detected_symptoms?.question_answers?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-3">Question Analysis</h4>
                <div className="space-y-3">
                  {selected.detected_symptoms.question_answers.map((qa: any, i: number) => {
                    const levelColors: Record<string, string> = {
                      ok: "text-success",
                      monitor: "text-warning",
                      concerning: "text-orange-400",
                      urgent: "text-error",
                      unclear: "text-purple-400",
                    };
                    const levelIcons: Record<string, string> = {
                      ok: "✓",
                      monitor: "◉",
                      concerning: "⚠",
                      urgent: "🔴",
                      unclear: "?",
                    };
                    return (
                      <div key={i} className="rounded-lg bg-background p-2.5 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-text-primary leading-snug">{qa.question}</p>
                          <span className={`text-xs font-bold shrink-0 ${levelColors[qa.concern_level] || "text-text-tertiary"}`}>
                            {levelIcons[qa.concern_level] || "—"} {qa.concern_level}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary italic leading-snug">{qa.answer_summary}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selected.detected_symptoms?.recommendations?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-text-primary mb-3">Recommendations</h4>
                <div className="space-y-1.5">
                  {selected.detected_symptoms.recommendations.map((r: string, i: number) => (
                    <p key={i} className="text-xs text-text-secondary">• {r}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Immediate attention banner for critical cases */}
            {selected.detected_symptoms?.needs_immediate_attention && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 animate-pulse">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-bold text-red-400 uppercase">Needs Immediate Attention</span>
                </div>
                <p className="text-xs text-red-300/80">
                  This patient requires urgent follow-up. Contact caregiver or schedule emergency visit.
                </p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-3">Actions</h4>
              <div className="space-y-2">
                <button className="w-full h-9 rounded-lg bg-error text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Escalate to Doctor
                </button>
                <button className="w-full h-9 rounded-lg bg-accent text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Schedule Follow-up
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
