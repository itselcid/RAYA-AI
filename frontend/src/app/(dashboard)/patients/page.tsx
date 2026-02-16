"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Plus,
  Phone,
  MapPin,
  Settings,
  X,
  Trash2,
  Save,
  MessageSquare,
  UserPlus,
  ChevronRight,
  ChevronLeft,
  Clock,
  ArrowRight,
  CheckCircle2,
  Edit3,
  User,
  Calendar,
  Activity,
  FileText,
} from "lucide-react";
import { patientsApi } from "@/lib/api";

interface Patient {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: string;
  condition: string;
  enrollment_date: string;
  city: string | null;
  status: string;
  language: string;
  call_frequency: string;
  call_time: string;
  notes: string | null;
}

interface Question {
  id?: string;
  question_text: string;
  question_english: string | null;
  category: string;
  order: number;
  is_active: boolean;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  recovered: "bg-blue-100 text-blue-700",
  at_risk: "bg-red-100 text-red-700",
  discharged: "bg-gray-100 text-gray-600",
};

const categoryColors: Record<string, string> = {
  vitals: "bg-blue-100 text-blue-700",
  medication: "bg-purple-100 text-purple-700",
  symptoms: "bg-red-100 text-red-700",
  diet: "bg-green-100 text-green-700",
  mental: "bg-yellow-100 text-yellow-700",
  general: "bg-gray-100 text-gray-700",
};

const categoryOptions = ["vitals", "medication", "symptoms", "diet", "mental", "general"];

const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  every_3_days: "Every 3 days",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

// Default questions per condition (frontend presets)
const CONDITION_PRESETS: Record<string, { label: string; keywords: string[]; questions: Omit<Question, "order" | "is_active">[] }> = {
  diabetes: {
    label: "Type 2 Diabetes",
    keywords: ["diabetes", "diabetic", "سكري"],
    questions: [
      { question_text: "واش قيستي السكر ديالك هاد الأسبوع؟ شحال طلع ليك؟", question_english: "Did you check your blood sugar this week? What was the reading?", category: "vitals" },
      { question_text: "واش كتاخد الدوا ديالك بانتظام كيف ما قال ليك الدكتور؟", question_english: "Are you taking your medication regularly as the doctor prescribed?", category: "medication" },
      { question_text: "واش نسيتي شي جرعة هاد الأسبوع؟", question_english: "Did you miss any doses this week?", category: "medication" },
      { question_text: "واش كتحس بشي تنميل فالرجلين ولا اليدين؟", question_english: "Do you feel any numbness in your feet or hands?", category: "symptoms" },
      { question_text: "كيفاش الماكلة ديالك؟ واش كتاكل مزيان؟", question_english: "How is your diet? Are you eating well?", category: "diet" },
      { question_text: "واش كتحس بشي غبشة فالعينين؟", question_english: "Do you feel any blurriness in your eyes?", category: "symptoms" },
    ],
  },
  hypertension: {
    label: "Hypertension",
    keywords: ["hypertension", "blood pressure", "ضغط"],
    questions: [
      { question_text: "واش قيستي الضغط ديالك؟ شحال كان؟", question_english: "Did you measure your blood pressure? What was the reading?", category: "vitals" },
      { question_text: "واش كتاخد الدوا ديال الضغط بانتظام؟", question_english: "Are you taking your blood pressure medication regularly?", category: "medication" },
      { question_text: "واش كتحس بشي صداع ولا دوخة؟", question_english: "Do you feel any headaches or dizziness?", category: "symptoms" },
      { question_text: "واش كتنقص الملح فالماكلة ديالك؟", question_english: "Are you reducing salt in your food?", category: "diet" },
      { question_text: "واش كتمشي ولا كدير شي رياضة؟", question_english: "Are you walking or doing any exercise?", category: "diet" },
      { question_text: "كيفاش النعاس ديالك بالليل؟", question_english: "How is your sleep at night?", category: "mental" },
    ],
  },
  heart: {
    label: "Heart Disease",
    keywords: ["heart", "cardiac", "قلب"],
    questions: [
      { question_text: "كيف كتحس اليوم؟ واش كتحس بشي ضيق فالصدر؟", question_english: "How do you feel today? Do you feel any tightness in your chest?", category: "symptoms" },
      { question_text: "واش كتاخد الأدوية ديالك كاملين بانتظام؟", question_english: "Are you taking all your medications regularly?", category: "medication" },
      { question_text: "واش كتلقى صعوبة فالتنفس خصوصا ملي كتمشي؟", question_english: "Do you have difficulty breathing especially when walking?", category: "symptoms" },
      { question_text: "واش كتحس بخفقان فالقلب ديالك؟", question_english: "Do you feel any heart palpitations?", category: "symptoms" },
      { question_text: "واش رجليك كينتافخو؟", question_english: "Are your legs swelling?", category: "symptoms" },
    ],
  },
  respiratory: {
    label: "Asthma / COPD",
    keywords: ["asthma", "copd", "respiratory", "breathing"],
    questions: [
      { question_text: "كيفاش التنفس ديالك هاد الأسبوع؟", question_english: "How has your breathing been this week?", category: "symptoms" },
      { question_text: "واش كتاخد الدوا ديالك بانتظام؟", question_english: "Are you taking your medication regularly?", category: "medication" },
      { question_text: "واش استعملتي البخاخ ديال الطوارئ هاد الأسبوع؟", question_english: "Did you use your emergency inhaler this week?", category: "medication" },
      { question_text: "واش كتسمع شي صفير ملي كتنفس؟", question_english: "Do you hear any wheezing when breathing?", category: "symptoms" },
      { question_text: "واش كتنعس مزيان بالليل بلا ما تنهج؟", question_english: "Do you sleep well at night without shortness of breath?", category: "mental" },
    ],
  },
  alzheimer: {
    label: "Alzheimer's / Dementia",
    keywords: ["alzheimer", "dementia", "memory"],
    questions: [
      { question_text: "كيف داير/ة اليوم؟ واش عرفتي شكون أنا؟", question_english: "How are you today? Do you remember who I am?", category: "general" },
      { question_text: "واش خديتي الدوا ديالك اليوم؟", question_english: "Did you take your medication today?", category: "medication" },
      { question_text: "واش كليتي وشربتي مزيان اليوم؟", question_english: "Did you eat and drink well today?", category: "diet" },
      { question_text: "واش نعستي مزيان البارح بالليل؟", question_english: "Did you sleep well last night?", category: "mental" },
      { question_text: "واش خرجتي من الدار ولا تمشيتي شوية؟", question_english: "Did you go outside or take a walk?", category: "diet" },
      { question_text: "واش كتحس بشي قلق ولا خوف ولا حزن؟", question_english: "Do you feel any anxiety, fear, or sadness?", category: "mental" },
      { question_text: "واش كاين شي حد معاك فالدار اليوم؟", question_english: "Is someone with you at home today?", category: "general" },
    ],
  },
  chemotherapy: {
    label: "Chemotherapy / Cancer",
    keywords: ["chemo", "cancer", "oncol", "tumor"],
    questions: [
      { question_text: "كيف كتحس من بعد الحصة ديال العلاج؟", question_english: "How do you feel after your treatment session?", category: "symptoms" },
      { question_text: "واش عندك شي غثيان ولا تقيو؟", question_english: "Do you have any nausea or vomiting?", category: "symptoms" },
      { question_text: "واش كتاخد الأدوية ديال الغثيان بانتظام؟", question_english: "Are you taking your anti-nausea medication regularly?", category: "medication" },
      { question_text: "واش كتقدر تاكل وتشرب مزيان؟", question_english: "Are you able to eat and drink well?", category: "diet" },
      { question_text: "واش عندك شي سخانة ولا برد؟", question_english: "Do you have any fever or chills?", category: "symptoms" },
      { question_text: "واش كتحس بتعب كبير ولا ضعف؟", question_english: "Do you feel extreme fatigue or weakness?", category: "symptoms" },
      { question_text: "واش شفتي شي تقرحات فالفم ديالك؟", question_english: "Have you noticed any mouth sores?", category: "symptoms" },
      { question_text: "واش كتنعس مزيان بالليل؟", question_english: "Are you sleeping well at night?", category: "mental" },
    ],
  },
  post_surgery: {
    label: "Post-Surgery",
    keywords: ["surgery", "operation", "post-op"],
    questions: [
      { question_text: "كيف كتحس اليوم من بعد العملية؟", question_english: "How do you feel today after the surgery?", category: "general" },
      { question_text: "واش كتاخد الدوا ديال الوجع بانتظام؟", question_english: "Are you taking your pain medication regularly?", category: "medication" },
      { question_text: "واش الجرح ديالك نظيف وماشي حامي ولا حمر؟", question_english: "Is your wound clean and not hot or red?", category: "symptoms" },
      { question_text: "واش كتحس بشي سخانة ولا حمى؟", question_english: "Do you feel any fever?", category: "symptoms" },
      { question_text: "واش كتقدر تمشي وتحرك براسك؟", question_english: "Are you able to walk and move on your own?", category: "symptoms" },
      { question_text: "واش كتاكل وكتشرب مزيان؟", question_english: "Are you eating and drinking well?", category: "diet" },
    ],
  },
};

function getDefaultQuestions(condition: string): Question[] {
  const c = condition.toLowerCase();
  const all: Omit<Question, "order" | "is_active">[] = [];
  for (const preset of Object.values(CONDITION_PRESETS)) {
    if (preset.keywords.some((kw) => c.includes(kw))) {
      all.push(...preset.questions);
    }
  }
  if (all.length === 0) {
    all.push(
      { question_text: "كيف كتحس اليوم بشكل عام؟", question_english: "How do you feel today overall?", category: "general" },
      { question_text: "واش كتاخد الدوا ديالك بانتظام؟", question_english: "Are you taking your medication regularly?", category: "medication" },
      { question_text: "واش عندك شي أعراض جديدة؟", question_english: "Do you have any new symptoms?", category: "symptoms" },
    );
  }
  return all.map((q, i) => ({ ...q, order: i + 1, is_active: true }));
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Add Patient modal
  const [showAdd, setShowAdd] = useState(false);
  const [addStep, setAddStep] = useState(1); // 1=info, 2=frequency, 3=questions
  const [addSaving, setAddSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", phone: "+212", age: "", gender: "male", condition: "",
    city: "", language: "darija", call_frequency: "weekly", call_time: "09:00", notes: "",
  });
  const [addQuestions, setAddQuestions] = useState<Question[]>([]);
  const [addNewQ, setAddNewQ] = useState({ text: "", english: "", category: "general" });

  // View/Edit patient detail
  const [viewPatient, setViewPatient] = useState<Patient | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);

  const openPatientDetail = (patient: Patient) => {
    setViewPatient(patient);
    setEditMode(false);
    setEditForm({
      name: patient.name,
      phone: patient.phone,
      age: patient.age,
      gender: patient.gender,
      condition: patient.condition,
      city: patient.city || "",
      language: patient.language,
      call_frequency: patient.call_frequency,
      call_time: patient.call_time || "09:00",
      status: patient.status,
      notes: patient.notes || "",
    });
  };

  const closePatientDetail = () => { setViewPatient(null); setEditMode(false); };

  const savePatientEdit = async () => {
    if (!viewPatient) return;
    setEditSaving(true);
    try {
      await patientsApi.update(viewPatient.id, {
        ...editForm,
        age: parseInt(editForm.age),
        city: editForm.city || null,
        notes: editForm.notes || null,
      });
      loadPatients();
      setEditMode(false);
      // Update the local viewPatient with new data
      setViewPatient({ ...viewPatient, ...editForm, age: parseInt(editForm.age) });
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to update patient");
    }
    setEditSaving(false);
  };

  // Edit questions modal
  const [configPatient, setConfigPatient] = useState<Patient | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newQ, setNewQ] = useState({ text: "", english: "", category: "general" });

  const loadPatients = useCallback(() => {
    patientsApi.list().then((res) => {
      setPatients(res.data || []);
    }).catch((err) => {
      console.error("Failed to load patients:", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        window.location.href = "/";
      }
    });
  }, []);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  const filtered = patients.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const weeksSinceEnrollment = (date: string) =>
    Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24 * 7));

  // --- Add Patient ---
  const openAddModal = () => {
    setShowAdd(true);
    setAddStep(1);
    setAddForm({ name: "", phone: "+212", age: "", gender: "male", condition: "", city: "", language: "darija", call_frequency: "weekly", call_time: "09:00", notes: "" });
    setAddQuestions([]);
    setAddNewQ({ text: "", english: "", category: "general" });
  };

  const closeAddModal = () => {
    setShowAdd(false);
    setAddStep(1);
  };

  const handleConditionChange = (condition: string) => {
    setAddForm((f) => ({ ...f, condition }));
    // Auto-populate questions based on condition
    if (condition.trim().length > 3) {
      setAddQuestions(getDefaultQuestions(condition));
    }
  };

  const addNewQuestion = () => {
    if (!addNewQ.text.trim()) return;
    setAddQuestions((prev) => [
      ...prev,
      { question_text: addNewQ.text.trim(), question_english: addNewQ.english.trim() || null, category: addNewQ.category, order: prev.length + 1, is_active: true },
    ]);
    setAddNewQ({ text: "", english: "", category: "general" });
  };

  const removeAddQuestion = (idx: number) => {
    setAddQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveAddQuestion = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= addQuestions.length) return;
    const updated = [...addQuestions];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setAddQuestions(updated);
  };

  const saveNewPatient = async () => {
    if (!addForm.name || !addForm.phone || !addForm.age || !addForm.condition) return;
    setAddSaving(true);
    try {
      await patientsApi.create({
        name: addForm.name,
        phone: addForm.phone,
        age: parseInt(addForm.age),
        gender: addForm.gender,
        condition: addForm.condition,
        enrollment_date: new Date().toISOString().split("T")[0],
        city: addForm.city || null,
        language: addForm.language,
        call_frequency: addForm.call_frequency,
        call_time: addForm.call_time,
        notes: addForm.notes || null,
        questions: addQuestions.map((q, i) => ({
          question_text: q.question_text,
          question_english: q.question_english || "",
          category: q.category,
          order: i + 1,
          is_active: true,
        })),
      });
      closeAddModal();
      loadPatients();
    } catch (e: any) {
      console.error("Failed to create patient:", e);
      alert(e.response?.data?.detail || "Failed to create patient");
    }
    setAddSaving(false);
  };

  // --- Edit Questions ---
  const openConfig = useCallback(async (patient: Patient) => {
    setConfigPatient(patient);
    setQuestionsLoading(true);
    try {
      const res = await patientsApi.getQuestions(patient.id);
      setQuestions(res.data.map((q: any) => ({
        id: q.id, question_text: q.question_text, question_english: q.question_english,
        category: q.category, order: q.order, is_active: q.is_active,
      })));
    } catch { setQuestions([]); }
    setQuestionsLoading(false);
  }, []);

  const closeConfig = () => { setConfigPatient(null); setQuestions([]); setNewQ({ text: "", english: "", category: "general" }); };

  const addQuestion = () => {
    if (!newQ.text.trim()) return;
    setQuestions((prev) => [...prev, { question_text: newQ.text.trim(), question_english: newQ.english.trim() || null, category: newQ.category, order: prev.length + 1, is_active: true }]);
    setNewQ({ text: "", english: "", category: "general" });
  };

  const removeQuestion = (idx: number) => setQuestions((prev) => prev.filter((_, i) => i !== idx));

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const updated = [...questions];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setQuestions(updated);
  };

  const saveQuestions = async () => {
    if (!configPatient) return;
    setSaving(true);
    try {
      await patientsApi.updateQuestions(configPatient.id, questions.map((q, i) => ({
        question_text: q.question_text, question_english: q.question_english || "", category: q.category, order: i + 1, is_active: q.is_active,
      })));
      closeConfig();
    } catch (e) { console.error("Failed to save questions:", e); }
    setSaving(false);
  };

  // Step validation
  const step1Valid = addForm.name.trim() && addForm.phone.trim() && addForm.age && addForm.gender && addForm.condition.trim();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between h-[68px] px-8 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">Patients</h1>
          <span className="text-sm text-text-tertiary bg-background px-2.5 py-0.5 rounded-full">{filtered.length}</span>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors">
          <UserPlus className="w-4 h-4" />
          Add Patient
        </button>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-3 px-8 py-4">
        <div className="flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-card flex-1 max-w-sm">
          <Search className="w-4 h-4 text-text-tertiary" />
          <input type="text" placeholder="Search patients..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-sm outline-none w-full" />
        </div>
        <div className="flex gap-2">
          {["all", "active", "at_risk", "recovered", "discharged"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`h-9 px-4 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? "bg-accent text-white" : "bg-card border border-border text-text-secondary hover:bg-background"}`}>
              {s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 px-8 pb-8 overflow-y-auto">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left px-5 py-3 font-medium text-text-secondary">Patient</th>
                <th className="text-left px-5 py-3 font-medium text-text-secondary">Condition</th>
                <th className="text-left px-5 py-3 font-medium text-text-secondary">Call Freq.</th>
                <th className="text-left px-5 py-3 font-medium text-text-secondary">Week</th>
                <th className="text-left px-5 py-3 font-medium text-text-secondary">City</th>
                <th className="text-left px-5 py-3 font-medium text-text-secondary">Status</th>
                <th className="text-center px-5 py-3 font-medium text-text-secondary">Questions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {filtered.map((patient) => (
                <tr key={patient.id} onClick={() => openPatientDetail(patient)} className="hover:bg-background/50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-accent-light flex items-center justify-center text-xs font-semibold text-accent shrink-0">
                        {patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">{patient.name}</p>
                        <p className="text-xs text-text-tertiary">{patient.age} yrs · {patient.gender} · {patient.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary text-xs">{patient.condition}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full w-fit">
                        <Clock className="w-3 h-3" />
                        {frequencyLabels[patient.call_frequency] || patient.call_frequency}
                      </span>
                      {patient.call_time && (
                        <span className="text-[10px] text-text-tertiary pl-0.5">
                          at {patient.call_time}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-accent text-xs">Week {weeksSinceEnrollment(patient.enrollment_date)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-text-secondary text-xs">
                      <MapPin className="w-3 h-3" />
                      {patient.city || "—"}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[patient.status] || "bg-gray-100 text-gray-600"}`}>
                      {patient.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button onClick={(e) => { e.stopPropagation(); openConfig(patient); }}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors">
                      <Settings className="w-3.5 h-3.5" /> Configure
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-text-tertiary">No patients found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========== ADD PATIENT MODAL ========== */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-border">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
              <div>
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-accent" />
                  Add New Patient
                </h2>
                <p className="text-sm text-text-secondary mt-0.5">
                  {addStep === 1 ? "Patient information" : addStep === 2 ? "Call schedule" : "Configure AI questions"}
                </p>
              </div>
              <button onClick={closeAddModal} className="p-2 rounded-lg hover:bg-background transition-colors">
                <X className="w-5 h-5 text-text-tertiary" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-0 px-6 pt-4 pb-2">
              {[
                { n: 1, label: "Patient Info" },
                { n: 2, label: "Call Schedule" },
                { n: 3, label: "AI Questions" },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center flex-1">
                  <div className={`flex items-center gap-2 ${addStep >= s.n ? "opacity-100" : "opacity-40"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      addStep > s.n ? "bg-green-500 text-white" : addStep === s.n ? "bg-accent text-white" : "bg-gray-200 text-gray-500"
                    }`}>
                      {addStep > s.n ? <CheckCircle2 className="w-4 h-4" /> : s.n}
                    </div>
                    <span className="text-xs font-medium text-text-primary">{s.label}</span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-0.5 mx-3 rounded ${addStep > s.n ? "bg-green-400" : "bg-gray-200"}`} />}
                </div>
              ))}
            </div>

            {/* Step Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* STEP 1: Patient Info */}
              {addStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-text-secondary mb-1 block">Full Name *</label>
                      <input type="text" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Fatima Zahra El Amrani" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1 block">Phone Number *</label>
                      <input type="tel" value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="+212 6XX-XXXXXX" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-text-secondary mb-1 block">Age *</label>
                        <input type="number" value={addForm.age} onChange={(e) => setAddForm((f) => ({ ...f, age: e.target.value }))}
                          placeholder="58" min={1} max={120} className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-text-secondary mb-1 block">Gender *</label>
                        <select value={addForm.gender} onChange={(e) => setAddForm((f) => ({ ...f, gender: e.target.value }))}
                          className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none">
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-text-secondary mb-1 block">Condition / Diagnosis *</label>
                      <input type="text" value={addForm.condition} onChange={(e) => handleConditionChange(e.target.value)}
                        placeholder="e.g. Type 2 Diabetes, Alzheimer's, Chemotherapy..."
                        className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.entries(CONDITION_PRESETS).map(([key, preset]) => (
                          <button key={key} type="button" onClick={() => handleConditionChange(preset.label)}
                            className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                              addForm.condition === preset.label
                                ? "bg-accent text-white border-accent"
                                : "bg-background border-border text-text-secondary hover:border-accent/40 hover:text-accent"
                            }`}>
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-text-tertiary mt-1">Select a preset or type any condition — AI questions auto-suggested</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1 block">City</label>
                      <input type="text" value={addForm.city} onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value }))}
                        placeholder="e.g. Casablanca" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-secondary mb-1 block">Language</label>
                      <select value={addForm.language} onChange={(e) => setAddForm((f) => ({ ...f, language: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none">
                        <option value="darija">Darija (Moroccan Arabic)</option>
                        <option value="arabic">Standard Arabic</option>
                        <option value="french">French</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-text-secondary mb-1 block">Notes</label>
                      <textarea value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Any extra notes for the AI or doctor..." rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm outline-none resize-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Call Frequency & Time */}
              {addStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-text-primary mb-1">How often should RAYA call?</p>
                    <p className="text-xs text-text-secondary mb-3">Choose how frequently the AI calls this patient for a check-in</p>
                    <div className="space-y-2">
                      {Object.entries(frequencyLabels).map(([key, label]) => (
                        <button key={key} onClick={() => setAddForm((f) => ({ ...f, call_frequency: key }))}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                            addForm.call_frequency === key ? "border-accent bg-accent/5 ring-2 ring-accent/20" : "border-border hover:border-accent/30 hover:bg-background"
                          }`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            addForm.call_frequency === key ? "bg-accent text-white" : "bg-background text-text-tertiary"
                          }`}>
                            <Clock className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{label}</p>
                            <p className="text-xs text-text-tertiary">
                              {key === "daily" ? "AI calls every day — for high-risk patients" :
                               key === "every_3_days" ? "AI calls every 3 days — for patients needing close monitoring" :
                               key === "weekly" ? "AI calls once a week — standard for most patients" :
                               key === "biweekly" ? "AI calls every 2 weeks — for stable patients" :
                               "AI calls once a month — for well-controlled patients"}
                            </p>
                          </div>
                          {addForm.call_frequency === key && (
                            <CheckCircle2 className="w-5 h-5 text-accent ml-auto shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Call Time Picker */}
                  <div className="border-t border-border pt-5">
                    <p className="text-sm font-semibold text-text-primary mb-1">What time should RAYA call?</p>
                    <p className="text-xs text-text-secondary mb-3">Pick the best time for this patient (Morocco time)</p>
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={addForm.call_time}
                        onChange={(e) => setAddForm((f) => ({ ...f, call_time: e.target.value }))}
                        className="h-12 px-4 rounded-xl border-2 border-border bg-white text-lg font-semibold text-text-primary outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {["08:00", "09:00", "10:00", "14:00", "16:00", "18:00"].map((t) => (
                          <button key={t} type="button" onClick={() => setAddForm((f) => ({ ...f, call_time: t }))}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                              addForm.call_time === t
                                ? "bg-accent text-white border-accent"
                                : "bg-background border-border text-text-secondary hover:border-accent/40"
                            }`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Questions */}
              {addStep === 3 && (
                <div className="space-y-3">
                  {addQuestions.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-text-tertiary uppercase tracking-wide">
                          {addQuestions.length} question{addQuestions.length !== 1 ? "s" : ""} configured
                        </p>
                        <span className="text-[10px] text-text-tertiary">Auto-suggested from condition</span>
                      </div>
                      {addQuestions.map((q, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-background/50 hover:bg-background transition-colors group">
                          <div className="flex flex-col items-center gap-0.5 pt-0.5">
                            <button onClick={() => moveAddQuestion(idx, -1)} disabled={idx === 0}
                              className="p-0.5 rounded hover:bg-card text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-20">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <span className="text-[10px] font-bold text-text-tertiary">{idx + 1}</span>
                            <button onClick={() => moveAddQuestion(idx, 1)} disabled={idx === addQuestions.length - 1}
                              className="p-0.5 rounded hover:bg-card text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-20">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-text-primary leading-relaxed" dir="rtl">{q.question_text}</p>
                            {q.question_english && <p className="text-[11px] text-text-tertiary mt-0.5">{q.question_english}</p>}
                            <span className={`inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${categoryColors[q.category] || categoryColors.general}`}>{q.category}</span>
                          </div>
                          <button onClick={() => removeAddQuestion(idx)}
                            className="p-1 rounded text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="w-10 h-10 text-text-tertiary mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-text-secondary font-medium">No questions yet</p>
                      <p className="text-xs text-text-tertiary mt-1">Add questions the AI should ask during calls</p>
                    </div>
                  )}

                  {/* Add question form */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex gap-2">
                      <input type="text" placeholder="سؤال بالدارجة... (Question in Darija)" value={addNewQ.text}
                        onChange={(e) => setAddNewQ((p) => ({ ...p, text: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addNewQuestion()}
                        className="flex-1 h-9 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-1 focus:ring-accent" dir="rtl" />
                      <select value={addNewQ.category} onChange={(e) => setAddNewQ((p) => ({ ...p, category: e.target.value }))}
                        className="h-9 px-2 rounded-lg border border-border bg-white text-xs outline-none">
                        {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input type="text" placeholder="English translation (optional)" value={addNewQ.english}
                        onChange={(e) => setAddNewQ((p) => ({ ...p, english: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addNewQuestion()}
                        className="flex-1 h-9 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-1 focus:ring-accent" />
                      <button onClick={addNewQuestion} disabled={!addNewQ.text.trim()}
                        className="h-9 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
              <div>
                {addStep > 1 && (
                  <button onClick={() => setAddStep((s) => s - 1)}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-sm text-text-secondary hover:bg-background transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={closeAddModal} className="h-9 px-4 rounded-lg border border-border text-sm text-text-secondary hover:bg-background transition-colors">
                  Cancel
                </button>
                {addStep < 3 ? (
                  <button onClick={() => setAddStep((s) => s + 1)} disabled={addStep === 1 && !step1Valid}
                    className="flex items-center gap-1.5 h-9 px-5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={saveNewPatient} disabled={addSaving || !step1Valid}
                    className="flex items-center gap-2 h-9 px-5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
                    <CheckCircle2 className="w-4 h-4" />
                    {addSaving ? "Saving..." : "Create Patient"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== VIEW / EDIT PATIENT DETAIL ========== */}
      {viewPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center text-base font-bold text-accent">
                  {viewPatient.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary">{editMode ? "Edit Patient" : viewPatient.name}</h2>
                  <p className="text-xs text-text-secondary">{viewPatient.condition} · Week {weeksSinceEnrollment(viewPatient.enrollment_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!editMode && (
                  <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                <button onClick={closePatientDetail} className="p-2 rounded-lg hover:bg-background transition-colors">
                  <X className="w-5 h-5 text-text-tertiary" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {editMode ? (
                /* ---- EDIT MODE ---- */
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Full Name</label>
                    <input type="text" value={editForm.name} onChange={(e) => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Phone</label>
                    <input type="text" value={editForm.phone} onChange={(e) => setEditForm((f: any) => ({ ...f, phone: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Age</label>
                    <input type="number" value={editForm.age} onChange={(e) => setEditForm((f: any) => ({ ...f, age: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Gender</label>
                    <select value={editForm.gender} onChange={(e) => setEditForm((f: any) => ({ ...f, gender: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Condition / Diagnosis</label>
                    <input type="text" value={editForm.condition} onChange={(e) => setEditForm((f: any) => ({ ...f, condition: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">City</label>
                    <input type="text" value={editForm.city} onChange={(e) => setEditForm((f: any) => ({ ...f, city: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Language</label>
                    <select value={editForm.language} onChange={(e) => setEditForm((f: any) => ({ ...f, language: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none">
                      <option value="darija">Darija</option>
                      <option value="arabic">Arabic (MSA)</option>
                      <option value="french">French</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Status</label>
                    <select value={editForm.status} onChange={(e) => setEditForm((f: any) => ({ ...f, status: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none">
                      <option value="active">Active</option>
                      <option value="at_risk">At Risk</option>
                      <option value="recovered">Recovered</option>
                      <option value="discharged">Discharged</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Call Frequency</label>
                    <select value={editForm.call_frequency} onChange={(e) => setEditForm((f: any) => ({ ...f, call_frequency: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none">
                      {Object.entries(frequencyLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Call Time</label>
                    <input type="time" value={editForm.call_time} onChange={(e) => setEditForm((f: any) => ({ ...f, call_time: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Notes</label>
                    <textarea value={editForm.notes} onChange={(e) => setEditForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3}
                      placeholder="Doctor's notes about this patient..."
                      className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none" />
                  </div>
                </div>
              ) : (
                /* ---- VIEW MODE ---- */
                <div className="space-y-6">
                  {/* Info Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-background rounded-xl p-4 border border-border">
                      <div className="flex items-center gap-2 text-text-tertiary mb-2">
                        <User className="w-4 h-4" />
                        <span className="text-[10px] font-medium uppercase tracking-wide">Personal</span>
                      </div>
                      <p className="text-sm font-semibold text-text-primary">{viewPatient.name}</p>
                      <p className="text-xs text-text-secondary mt-1">{viewPatient.age} years · {viewPatient.gender}</p>
                      <p className="text-xs text-text-secondary">{viewPatient.city || "No city"}</p>
                    </div>
                    <div className="bg-background rounded-xl p-4 border border-border">
                      <div className="flex items-center gap-2 text-text-tertiary mb-2">
                        <Phone className="w-4 h-4" />
                        <span className="text-[10px] font-medium uppercase tracking-wide">Contact</span>
                      </div>
                      <p className="text-sm font-semibold text-text-primary">{viewPatient.phone}</p>
                      <p className="text-xs text-text-secondary mt-1">Language: {viewPatient.language}</p>
                    </div>
                    <div className="bg-background rounded-xl p-4 border border-border">
                      <div className="flex items-center gap-2 text-text-tertiary mb-2">
                        <Calendar className="w-4 h-4" />
                        <span className="text-[10px] font-medium uppercase tracking-wide">Enrollment</span>
                      </div>
                      <p className="text-sm font-semibold text-text-primary">Week {weeksSinceEnrollment(viewPatient.enrollment_date)}</p>
                      <p className="text-xs text-text-secondary mt-1">Since {viewPatient.enrollment_date}</p>
                    </div>
                  </div>

                  {/* Condition & Status */}
                  <div className="bg-background rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 text-text-tertiary mb-3">
                      <Activity className="w-4 h-4" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">Medical</span>
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{viewPatient.condition}</p>
                        <span className={`inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[viewPatient.status] || "bg-gray-100 text-gray-600"}`}>
                          {viewPatient.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Call Schedule */}
                  <div className="bg-background rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 text-text-tertiary mb-3">
                      <Clock className="w-4 h-4" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">AI Call Schedule</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5" />
                          {frequencyLabels[viewPatient.call_frequency] || viewPatient.call_frequency}
                        </span>
                      </div>
                      {viewPatient.call_time && (
                        <span className="text-sm text-text-primary font-medium">at {viewPatient.call_time}</span>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {viewPatient.notes && (
                    <div className="bg-background rounded-xl p-4 border border-border">
                      <div className="flex items-center gap-2 text-text-tertiary mb-3">
                        <FileText className="w-4 h-4" />
                        <span className="text-[10px] font-medium uppercase tracking-wide">Notes</span>
                      </div>
                      <p className="text-sm text-text-secondary">{viewPatient.notes}</p>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-3">
                    <button onClick={() => { closePatientDetail(); openConfig(viewPatient); }}
                      className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors">
                      <Settings className="w-3.5 h-3.5" /> Configure AI Questions
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer for edit mode */}
            {editMode && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
                <button onClick={() => setEditMode(false)} className="h-9 px-4 rounded-lg border border-border text-sm text-text-secondary hover:bg-background transition-colors">
                  Cancel
                </button>
                <button onClick={savePatientEdit} disabled={editSaving}
                  className="flex items-center gap-2 h-9 px-5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50">
                  <Save className="w-4 h-4" /> {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== EDIT QUESTIONS MODAL ========== */}
      {configPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
              <div>
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-accent" /> AI Call Questions
                </h2>
                <p className="text-sm text-text-secondary mt-0.5">
                  Configure questions for <span className="font-medium">{configPatient.name}</span>
                </p>
              </div>
              <button onClick={closeConfig} className="p-2 rounded-lg hover:bg-background transition-colors">
                <X className="w-5 h-5 text-text-tertiary" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {questionsLoading ? (
                <div className="text-center py-12 text-text-tertiary">Loading questions...</div>
              ) : questions.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
                  <p className="text-text-secondary font-medium">No questions configured yet</p>
                </div>
              ) : (
                questions.map((q, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background/50 hover:bg-background transition-colors group">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <button onClick={() => moveQuestion(idx, -1)} disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-card text-text-tertiary hover:text-text-primary disabled:opacity-30">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <span className="text-xs font-bold text-text-tertiary">{idx + 1}</span>
                      <button onClick={() => moveQuestion(idx, 1)} disabled={idx === questions.length - 1}
                        className="p-0.5 rounded hover:bg-card text-text-tertiary hover:text-text-primary disabled:opacity-30">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary leading-relaxed" dir="rtl">{q.question_text}</p>
                      {q.question_english && <p className="text-xs text-text-tertiary mt-1">{q.question_english}</p>}
                      <span className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${categoryColors[q.category] || categoryColors.general}`}>{q.category}</span>
                    </div>
                    <button onClick={() => removeQuestion(idx)}
                      className="p-1.5 rounded-lg text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-border px-6 py-4 space-y-3 bg-background/30">
              <div className="flex gap-2">
                <input type="text" placeholder="سؤال بالدارجة..." value={newQ.text}
                  onChange={(e) => setNewQ((p) => ({ ...p, text: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addQuestion()}
                  className="flex-1 h-9 px-3 rounded-lg border border-border bg-card text-sm outline-none focus:ring-1 focus:ring-accent" dir="rtl" />
                <select value={newQ.category} onChange={(e) => setNewQ((p) => ({ ...p, category: e.target.value }))}
                  className="h-9 px-2 rounded-lg border border-border bg-card text-xs outline-none">
                  {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="English translation (optional)" value={newQ.english}
                  onChange={(e) => setNewQ((p) => ({ ...p, english: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addQuestion()}
                  className="flex-1 h-9 px-3 rounded-lg border border-border bg-card text-sm outline-none focus:ring-1 focus:ring-accent" />
                <button onClick={addQuestion} disabled={!newQ.text.trim()}
                  className="h-9 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
              <p className="text-xs text-text-tertiary">{questions.length} question{questions.length !== 1 ? "s" : ""} configured</p>
              <div className="flex gap-2">
                <button onClick={closeConfig} className="h-9 px-4 rounded-lg border border-border text-sm text-text-secondary hover:bg-background transition-colors">Cancel</button>
                <button onClick={saveQuestions} disabled={saving}
                  className="flex items-center gap-2 h-9 px-5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Questions"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
