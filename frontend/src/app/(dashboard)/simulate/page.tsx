"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Phone,
  PhoneOff,
  Send,
  Bot,
  User,
  Languages,
  AlertTriangle,
  Loader2,
  Volume2,
  Activity,
  Mic,
  MicOff,
  AudioLines,
  CheckCircle2,
  ShieldAlert,
  XCircle,
  FileText,
  MessageSquare,
} from "lucide-react";
import { patientsApi, simulateApi, callsApi } from "@/lib/api";

interface Message {
  role: "ai" | "patient";
  darija: string;
  english: string | null;
  time: string;
}

interface DoctorQuestion {
  id: string;
  text: string;
  english: string | null;
  category: string;
  order: number;
}

function SimulatePageInner() {
  const searchParams = useSearchParams();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [callId, setCallId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [ending, setEnding] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micAvailable, setMicAvailable] = useState(false);
  const [autoSend, setAutoSend] = useState(true);
  const [callTimer, setCallTimer] = useState(0);

  // Doctor's configured questions
  const [doctorQuestions, setDoctorQuestions] = useState<DoctorQuestion[]>([]);

  // Doctor review state
  const [reviewAction, setReviewAction] = useState<string | null>(null);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    patientsApi.list().then((res) => {
      setPatients(res.data);
      // Auto-select patient from URL query param (from Call Queue)
      const preselect = searchParams.get("patient");
      if (preselect && res.data.some((p: any) => p.id === preselect)) {
        setSelectedPatient(preselect);
      }
    });
  }, [searchParams]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Call timer
  useEffect(() => {
    if (callActive) {
      setCallTimer(0);
      callTimerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
    } else {
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [callActive]);

  // Check if microphone is available
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const hasMic = devices.some((d) => d.kind === "audioinput" && d.deviceId !== "");
        setMicAvailable(hasMic);
      }).catch(() => setMicAvailable(false));
    }
  }, []);

  const now = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // --- TTS ---
  const speakText = useCallback((darija: string, english: string | null) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(
      (v) => v.lang.startsWith("ar") && v.name.toLowerCase().includes("female")
    ) || voices.find((v) => v.lang.startsWith("ar"));
    const utterance = new SpeechSynthesisUtterance(arabicVoice ? darija : (english || darija));
    if (arabicVoice) {
      utterance.lang = "ar-MA";
      utterance.voice = arabicVoice;
    } else {
      utterance.lang = "en-US";
      const engVoice = voices.find(
        (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")
      ) || voices.find((v) => v.lang.startsWith("en"));
      if (engVoice) utterance.voice = engVoice;
    }
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const playAiResponse = useCallback((darija: string, english: string | null, audioBase64: string | null) => {
    if (audioBase64) {
      try {
        const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
        setSpeaking(true);
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => { setSpeaking(false); speakText(darija, english); };
        audio.play();
        return;
      } catch { /* fall through */ }
    }
    speakText(darija, english);
  }, [speakText]);

  // --- STT ---
  const micTranscriptRef = useRef("");
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || !micAvailable) return;
    setInput("");
    micTranscriptRef.current = "";
    navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
      const recognition = new SpeechRecognition();
      recognition.lang = "ar";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setListening(true);
      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        const text = finalTranscript || interimTranscript;
        micTranscriptRef.current = text;
        setInput(text);
      };
      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
        const text = micTranscriptRef.current.trim();
        if (text) {
          setInput("");
          micTranscriptRef.current = "";
          sendMessageRef.current(text);
        }
      };
      recognition.onerror = () => {
        setListening(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      recognition.start();
    }).catch(() => setMicAvailable(false));
  }, [micAvailable]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
  }, []);

  // --- Call flow ---
  const startCall = async () => {
    if (!selectedPatient) return;
    setLoading(true);
    setMessages([]);
    setAnalysis(null);
    setDoctorQuestions([]);
    setReviewAction(null);
    setDoctorNotes("");
    setReviewDone(false);
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();

    try {
      const res = await simulateApi.start(selectedPatient);
      setCallId(res.data.call_id);
      setCallActive(true);

      // Store doctor's questions from backend
      if (res.data.questions) {
        setDoctorQuestions(res.data.questions);
      }

      const greeting: Message = {
        role: "ai",
        darija: res.data.greeting_darija,
        english: res.data.greeting_english,
        time: now(),
      };
      setMessages([greeting]);
      playAiResponse(res.data.greeting_darija, res.data.greeting_english, res.data.audio_base64);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to start call");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || !callId) return;
    setInput("");
    micTranscriptRef.current = "";
    setLoading(true);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);

    setMessages((prev) => [
      ...prev,
      { role: "patient", darija: text, english: null, time: now() },
    ]);

    try {
      const res = await simulateApi.message(callId, text);
      const aiDarija = (res.data.ai_darija || "").replace("[CALL_COMPLETE]", "").trim();
      const aiEnglish = (res.data.ai_english || "").replace("[CALL_COMPLETE]", "").trim();
      const isCallComplete = (res.data.ai_darija || "").includes("[CALL_COMPLETE]");

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          english: res.data.patient_english,
        };
        return [
          ...updated,
          {
            role: "ai",
            darija: aiDarija,
            english: aiEnglish,
            time: now(),
          },
        ];
      });
      playAiResponse(aiDarija, aiEnglish, res.data.audio_base64);

      // Auto-end call when AI has finished all questions
      if (isCallComplete) {
        setTimeout(() => {
          endCall();
        }, 4000); // Give 4s for the goodbye message to play
      }
    } catch {
      // ok
    } finally {
      setLoading(false);
    }
  };

  sendMessageRef.current = (text: string) => sendMessage(text);

  const endCall = async () => {
    if (!callId) return;
    setEnding(true);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
    try {
      const res = await simulateApi.end(callId);
      const analysisData = res.data.analysis;
      setAnalysis(analysisData || {
        risk_score: 0.3,
        risk_level: "medium",
        detected_symptoms: [],
        summary: `Call completed with ${messages.length} messages exchanged. Manual review recommended.`,
        recommendations: ["Review call transcript", "Follow up with patient if needed"],
        needs_immediate_attention: false,
        status: "pending_review",
      });
      setCallActive(false);
    } catch (err) {
      console.error("End call error:", err);
      setCallActive(false);
      setAnalysis({
        risk_score: 0.3,
        risk_level: "medium",
        detected_symptoms: [],
        summary: `Call completed with ${messages.length} messages. Risk analysis unavailable.`,
        recommendations: ["Review call transcript manually"],
        needs_immediate_attention: false,
        status: "pending_review",
      });
    } finally {
      setEnding(false);
    }
  };

  // Doctor review
  const submitReview = async () => {
    if (!callId || !reviewAction) return;
    setReviewing(true);
    try {
      await callsApi.review(callId, {
        action: reviewAction,
        doctor_notes: doctorNotes || undefined,
      });
      setReviewDone(true);
    } catch (err) {
      console.error("Review error:", err);
    }
    setReviewing(false);
  };

  const handleMicToggle = () => {
    if (listening) stopListening();
    else startListening();
  };

  const patient = patients.find((p) => p.id === selectedPatient);

  // Estimate which questions have been covered (by message exchange count)
  const questionsAnswered = Math.min(
    doctorQuestions.length,
    Math.floor(messages.filter((m) => m.role === "patient").length)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className={`flex items-center justify-between h-[68px] px-8 border-b shrink-0 transition-colors ${
        callActive ? "bg-success/5 border-success/20" : "bg-card border-border"
      }`}>
        <div className="flex items-center gap-3">
          {callActive ? (
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-success flex items-center justify-center">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success animate-ping" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success" />
            </div>
          ) : (
            <Activity className="w-5 h-5 text-accent" />
          )}
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              {callActive ? "Call In Progress" : "AI Call Simulator"}
            </h1>
            {callActive && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-success font-bold">
                  {String(Math.floor(callTimer / 60)).padStart(2, "0")}:{String(callTimer % 60).padStart(2, "0")}
                </span>
                {speaking ? (
                  <span className="flex items-center gap-1 text-xs text-accent font-medium">
                    <AudioLines className="w-3 h-3 animate-pulse" /> AI Speaking
                  </span>
                ) : loading ? (
                  <span className="flex items-center gap-1 text-xs text-text-tertiary font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" /> AI Thinking...
                  </span>
                ) : (
                  <span className="text-xs text-text-tertiary">Waiting for patient...</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!callActive ? (
            <>
              <select
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                className="h-10 px-4 rounded-lg border border-border bg-white text-sm"
              >
                <option value="">Select patient...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.condition}
                  </option>
                ))}
              </select>
              <button
                onClick={startCall}
                disabled={!selectedPatient || loading}
                className="h-10 px-5 rounded-lg bg-accent text-white text-sm font-semibold flex items-center gap-2 hover:bg-accent-hover disabled:opacity-50 transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                Start AI Call
              </button>
            </>
          ) : (
            <button
              onClick={endCall}
              disabled={ending}
              className="h-10 px-5 rounded-lg bg-error text-white text-sm font-semibold flex items-center gap-2 hover:bg-red-600 transition-all animate-pulse hover:animate-none"
            >
              {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneOff className="w-4 h-4" />}
              End Call
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Patient Info */}
          {patient && callActive && (
            <div className="flex items-center gap-4 px-6 py-3 bg-card border-b border-border">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">RAYA AI is calling {patient.name}</p>
                <p className="text-xs text-text-secondary">
                  Health check-in · {patient.condition} · {doctorQuestions.length} doctor questions
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-accent-light text-accent text-xs font-medium">You are the patient</span>
              </div>
            </div>
          )}

          {/* Call Ended Banner */}
          {!callActive && analysis && messages.length > 0 && (
            <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {reviewDone ? "Review Submitted" : "Pending Doctor Review"}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {messages.length} messages · {patient?.name} · AI evaluation ready
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                  analysis.risk_level === "critical" ? "bg-red-600 text-white" :
                  analysis.risk_level === "high" ? "bg-red-500 text-white" :
                  analysis.risk_level === "medium" ? "bg-amber-500 text-white" :
                  "bg-green-500 text-white"
                }`}>
                  AI Risk: {Math.round((analysis.risk_score || 0) * 100)}%
                </span>
                <button
                  onClick={() => { setAnalysis(null); setMessages([]); setCallId(null); setDoctorQuestions([]); setReviewAction(null); setDoctorNotes(""); setReviewDone(false); }}
                  className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-text-secondary hover:bg-background"
                >
                  New Call
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-5 bg-background">
            {messages.length === 0 && !callActive && !analysis && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-accent-light flex items-center justify-center">
                  <Bot className="w-8 h-8 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">AI Call Simulator</h2>
                  <p className="text-sm text-text-secondary mt-1 max-w-md">
                    The AI calls the patient and asks the doctor's configured questions in Darija.
                    You role-play as the patient. After the call, the doctor reviews and decides.
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-text-tertiary">
                    <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-accent" /> Doctor configures questions</span>
                    <span>→</span>
                    <span className="flex items-center gap-1.5"><Bot className="w-3.5 h-3.5 text-accent" /> AI asks in Darija</span>
                    <span>→</span>
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Doctor reviews</span>
                  </div>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "patient" ? "justify-end" : ""}`}>
                {msg.role === "ai" && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    speaking && i === messages.length - 1 ? "bg-accent ring-4 ring-accent/20 animate-pulse" : "bg-accent"
                  }`}>
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`max-w-lg space-y-1.5 ${msg.role === "patient" ? "items-end" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${msg.role === "ai" ? "text-accent" : "text-info"}`}>
                      {msg.role === "ai" ? "RAYA AI (caller)" : "You (as patient)"}
                    </span>
                    <span className="text-xs text-text-tertiary">{msg.time}</span>
                    {msg.role === "ai" && speaking && i === messages.length - 1 && (
                      <AudioLines className="w-3 h-3 text-accent animate-pulse" />
                    )}
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "ai"
                        ? "bg-card rounded-tl-sm shadow-sm"
                        : "bg-info-light rounded-tr-sm"
                    }`}
                    dir={msg.role === "ai" ? "rtl" : "auto"}
                  >
                    {msg.darija}
                  </div>
                  {msg.english && (
                    <div className="flex items-center gap-1.5 px-1">
                      <Languages className="w-3 h-3 text-text-tertiary" />
                      <span className="text-xs italic text-text-tertiary">{msg.english}</span>
                    </div>
                  )}
                </div>
                {msg.role === "patient" && (
                  <div className="w-8 h-8 rounded-full bg-info-light flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-info" />
                  </div>
                )}
              </div>
            ))}

            {loading && messages.length > 0 && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-card rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          {callActive && (
            <div className="px-6 py-4 bg-card border-t border-border">
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                className="flex items-center gap-3"
              >
                <div className="flex-1 flex items-center gap-2 h-12 px-4 rounded-2xl border border-border bg-white focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent transition-all">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInput(val);
                      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                      if (autoSend && val.trim() && !loading) {
                        typingTimerRef.current = setTimeout(() => {
                          sendMessage(val.trim());
                        }, 2000);
                      }
                    }}
                    placeholder="Type as the patient in Darija... e.g. الحمد لله بصح السكر طالع"
                    className="flex-1 bg-transparent text-sm outline-none"
                    disabled={loading}
                    dir="auto"
                    autoFocus
                  />
                  {listening && (
                    <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium shrink-0">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Listening...
                    </span>
                  )}
                </div>
                {micAvailable && (
                  <button
                    type="button"
                    onClick={handleMicToggle}
                    disabled={loading}
                    className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                      listening
                        ? "bg-red-500 text-white ring-4 ring-red-500/30"
                        : "bg-background border border-border text-text-secondary hover:bg-accent-light hover:text-accent"
                    } disabled:opacity-50`}
                  >
                    {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="h-12 w-12 rounded-2xl bg-accent text-white flex items-center justify-center hover:bg-accent-hover disabled:opacity-50 transition-all shrink-0"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
              <div className="flex items-center justify-between mt-2 px-1">
                <p className="text-xs text-text-tertiary">
                  Type &amp; pause 2s to auto-send, or press Enter
                </p>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <span className="text-xs text-text-tertiary">Auto-send</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoSend}
                    onClick={() => {
                      setAutoSend((v) => !v);
                      if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
                    }}
                    className={`relative w-8 h-[18px] rounded-full transition-colors ${autoSend ? "bg-accent" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform shadow-sm ${autoSend ? "translate-x-[14px]" : ""}`} />
                  </button>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Questions / Analysis / Review */}
        {(callActive || analysis) && (
          <div className="w-[340px] border-l border-border bg-card overflow-y-auto shrink-0 p-5 space-y-5">
            {analysis ? (
              <>
                {/* AI EVALUATION — Pending Doctor Review */}
                <div className="rounded-xl p-4 bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                    <h3 className="text-sm font-bold text-amber-800">
                      AI Evaluation {reviewDone ? "— Reviewed" : "— Pending Review"}
                    </h3>
                  </div>
                  <p className="text-xs text-amber-700">
                    {reviewDone
                      ? `Doctor has ${reviewAction === "escalate" ? "escalated" : reviewAction === "approve" ? "approved" : "dismissed"} this evaluation.`
                      : "This is the AI's suggestion. You (the doctor) make the final decision."
                    }
                  </p>
                </div>

                {/* Risk Score */}
                <div className={`rounded-2xl p-4 text-center space-y-2 ${
                  analysis.risk_level === "critical" ? "bg-red-600 text-white" :
                  analysis.risk_level === "high" ? "bg-red-100" :
                  analysis.risk_level === "medium" ? "bg-amber-100" :
                  "bg-green-100"
                }`}>
                  <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center text-xl font-black border-4 ${
                    analysis.risk_level === "critical" ? "bg-red-700 border-red-400 text-white" :
                    analysis.risk_level === "high" ? "bg-red-500 border-red-300 text-white" :
                    analysis.risk_level === "medium" ? "bg-amber-500 border-amber-300 text-white" :
                    "bg-green-500 border-green-300 text-white"
                  }`}>
                    {Math.round((analysis.risk_score || 0) * 100)}%
                  </div>
                  <p className={`text-sm font-bold uppercase ${
                    analysis.risk_level === "critical" ? "text-white" :
                    analysis.risk_level === "high" ? "text-red-700" :
                    analysis.risk_level === "medium" ? "text-amber-700" :
                    "text-green-700"
                  }`}>
                    {analysis.risk_level} risk
                  </p>
                </div>

                {/* Question Answers (from AI analysis) */}
                {analysis.question_answers?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wide mb-2">Question Responses</h4>
                    <div className="space-y-2">
                      {analysis.question_answers.map((qa: any, i: number) => (
                        <div key={i} className={`p-2.5 rounded-lg border text-xs ${
                          qa.concern_level === "urgent" ? "bg-red-50 border-red-200" :
                          qa.concern_level === "concerning" ? "bg-amber-50 border-amber-200" :
                          qa.concern_level === "monitor" ? "bg-blue-50 border-blue-200" :
                          qa.concern_level === "unclear" ? "bg-purple-50 border-purple-200" :
                          "bg-green-50 border-green-200"
                        }`}>
                          <p className="font-medium text-text-primary mb-0.5">{qa.question}</p>
                          <p className="text-text-secondary">{qa.answer_summary}</p>
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            qa.concern_level === "urgent" ? "bg-red-500 text-white" :
                            qa.concern_level === "concerning" ? "bg-amber-500 text-white" :
                            qa.concern_level === "monitor" ? "bg-blue-500 text-white" :
                            qa.concern_level === "unclear" ? "bg-purple-500 text-white" :
                            "bg-green-500 text-white"
                          }`}>{qa.concern_level === "unclear" ? "⚠ unclear — needs follow-up" : qa.concern_level}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                {analysis.summary && (
                  <div className="rounded-xl border border-border p-3 bg-background">
                    <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wide mb-1">AI Summary</h4>
                    <p className="text-xs text-text-primary leading-relaxed">{analysis.summary}</p>
                  </div>
                )}

                {/* Detected Issues */}
                {analysis.detected_symptoms?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wide mb-2">Detected Issues</h4>
                    <div className="space-y-1.5">
                      {analysis.detected_symptoms.map((s: any, i: number) => (
                        <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border ${
                          s.severity === "severe" ? "bg-red-50 border-red-200" :
                          s.severity === "moderate" ? "bg-amber-50 border-amber-200" :
                          "bg-green-50 border-green-200"
                        }`}>
                          <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                            s.severity === "severe" ? "bg-red-500" : s.severity === "moderate" ? "bg-amber-500" : "bg-green-500"
                          }`} />
                          <div>
                            <span className="text-xs font-semibold text-text-primary">{s.symptom}</span>
                            <span className={`text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full font-bold ${
                              s.severity === "severe" ? "bg-red-500 text-white" :
                              s.severity === "moderate" ? "bg-amber-500 text-white" :
                              "bg-green-500 text-white"
                            }`}>{s.severity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {analysis.recommendations?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wide mb-2">AI Recommendations</h4>
                    <div className="space-y-1.5">
                      {analysis.recommendations.map((r: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-accent/5">
                          <span className="w-4 h-4 rounded-full bg-accent text-white text-[10px] flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</span>
                          <p className="text-xs text-text-primary">{r}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DOCTOR REVIEW PANEL */}
                {!reviewDone ? (
                  <div className="rounded-xl border-2 border-accent p-4 space-y-3">
                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                      Doctor Decision
                    </h4>
                    <p className="text-xs text-text-secondary">Review the AI evaluation above and decide:</p>

                    <div className="space-y-2">
                      <button
                        onClick={() => setReviewAction("approve")}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                          reviewAction === "approve"
                            ? "border-green-500 bg-green-50 ring-2 ring-green-500/20"
                            : "border-border hover:border-green-300 hover:bg-green-50/50"
                        }`}
                      >
                        <CheckCircle2 className={`w-5 h-5 ${reviewAction === "approve" ? "text-green-600" : "text-green-400"}`} />
                        <div>
                          <p className="text-sm font-semibold text-text-primary">Approve — No Action</p>
                          <p className="text-xs text-text-tertiary">Patient is stable, no follow-up needed</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setReviewAction("escalate")}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                          reviewAction === "escalate"
                            ? "border-red-500 bg-red-50 ring-2 ring-red-500/20"
                            : "border-border hover:border-red-300 hover:bg-red-50/50"
                        }`}
                      >
                        <ShieldAlert className={`w-5 h-5 ${reviewAction === "escalate" ? "text-red-600" : "text-red-400"}`} />
                        <div>
                          <p className="text-sm font-semibold text-text-primary">Escalate — Create Alert</p>
                          <p className="text-xs text-text-tertiary">Flag as at-risk, create alert for follow-up</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setReviewAction("dismiss")}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                          reviewAction === "dismiss"
                            ? "border-gray-500 bg-gray-50 ring-2 ring-gray-500/20"
                            : "border-border hover:border-gray-300 hover:bg-gray-50/50"
                        }`}
                      >
                        <XCircle className={`w-5 h-5 ${reviewAction === "dismiss" ? "text-gray-600" : "text-gray-400"}`} />
                        <div>
                          <p className="text-sm font-semibold text-text-primary">Dismiss</p>
                          <p className="text-xs text-text-tertiary">Evaluation not relevant, dismiss</p>
                        </div>
                      </button>
                    </div>

                    {/* Doctor notes */}
                    <textarea
                      value={doctorNotes}
                      onChange={(e) => setDoctorNotes(e.target.value)}
                      placeholder="Add notes (optional)..."
                      className="w-full h-16 px-3 py-2 rounded-lg border border-border bg-background text-xs outline-none resize-none focus:ring-1 focus:ring-accent"
                    />

                    <button
                      onClick={submitReview}
                      disabled={!reviewAction || reviewing}
                      className="w-full h-10 rounded-lg bg-accent text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-accent-hover disabled:opacity-50 transition-all"
                    >
                      {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Submit Review
                    </button>
                  </div>
                ) : (
                  <div className={`rounded-xl p-4 text-center space-y-2 ${
                    reviewAction === "escalate" ? "bg-red-50 border border-red-200" :
                    reviewAction === "approve" ? "bg-green-50 border border-green-200" :
                    "bg-gray-50 border border-gray-200"
                  }`}>
                    {reviewAction === "escalate" ? (
                      <>
                        <ShieldAlert className="w-8 h-8 text-red-500 mx-auto" />
                        <p className="text-sm font-bold text-red-700">Escalated — Alert Created</p>
                        <p className="text-xs text-red-600">Patient flagged as at-risk. Check Alerts page.</p>
                      </>
                    ) : reviewAction === "approve" ? (
                      <>
                        <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
                        <p className="text-sm font-bold text-green-700">Approved — No Action Needed</p>
                        <p className="text-xs text-green-600">Patient check-in reviewed and cleared.</p>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-8 h-8 text-gray-500 mx-auto" />
                        <p className="text-sm font-bold text-gray-700">Dismissed</p>
                        <p className="text-xs text-gray-600">This evaluation has been dismissed.</p>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* LIVE CALL PANEL — Doctor's questions checklist */
              <div className="space-y-4">
                <h3 className="font-semibold text-text-primary">Live Call</h3>

                {/* Active call indicator */}
                <div className="rounded-xl p-4 bg-accent-light border border-accent/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                        <Phone className="w-5 h-5 text-white" />
                      </div>
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success border-2 border-card animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-accent">AI Call Active</p>
                      <p className="text-xs text-text-secondary">
                        {messages.length} messages exchanged
                      </p>
                    </div>
                  </div>
                  {doctorQuestions.length > 0 && (
                    <div className="w-full bg-accent/20 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (questionsAnswered / doctorQuestions.length) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Doctor's questions checklist */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-text-tertiary uppercase tracking-wide">
                      Doctor's Questions
                    </h4>
                    <span className="text-xs font-semibold text-accent">
                      {questionsAnswered}/{doctorQuestions.length}
                    </span>
                  </div>
                  {doctorQuestions.length > 0 ? (
                    doctorQuestions.map((q, i) => {
                      const checked = i < questionsAnswered;
                      return (
                        <div
                          key={q.id || i}
                          className={`flex items-start gap-2.5 py-2 px-2.5 rounded-lg mb-1.5 transition-all ${
                            checked ? "bg-green-50" : i === questionsAnswered ? "bg-accent/5 border border-accent/20" : ""
                          }`}
                        >
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold transition-all shrink-0 mt-0.5 ${
                            checked
                              ? "bg-green-500 text-white shadow-sm"
                              : i === questionsAnswered
                              ? "border-2 border-accent bg-accent/10 text-accent"
                              : "border border-border bg-background"
                          }`}>
                            {checked ? "✓" : i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className={`text-xs leading-relaxed ${checked ? "text-text-primary font-medium" : i === questionsAnswered ? "text-accent font-medium" : "text-text-tertiary"}`}>
                              {q.english || q.text}
                            </p>
                            {i === questionsAnswered && (
                              <span className="text-[10px] text-accent font-medium">← Current question</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-text-tertiary text-center py-4">
                      No questions configured for this patient.
                      <br />AI will use default questions.
                    </div>
                  )}
                </div>

                <p className="text-xs text-text-tertiary text-center italic">
                  AI evaluation runs when call ends — doctor reviews the result
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SimulatePage() {
  return (
    <Suspense>
      <SimulatePageInner />
    </Suspense>
  );
}
