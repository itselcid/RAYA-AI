"use client";

import { useState, useEffect } from "react";
import {
  User,
  Building,
  Phone,
  Mail,
  Globe,
  Bot,
  Shield,
  Bell,
  Save,
} from "lucide-react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clinic, setClinic] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("raya_user");
    if (user) {
      try {
        const data = JSON.parse(user);
        setName(data.name || "");
        setEmail(data.email || "");
        setClinic(data.clinic_name || "");
        setPhone(data.phone || "");
      } catch {}
    }
  }, []);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between h-[68px] px-8 bg-card border-b border-border shrink-0">
        <h1 className="text-xl font-bold text-text-primary">Settings</h1>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <Save className="w-4 h-4" />
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </header>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl space-y-8">
          {/* Profile */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Profile</h2>
            <div className="bg-card rounded-xl border border-border p-6 space-y-5">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-white text-xl font-bold">
                  {name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-text-primary">{name || "Doctor"}</p>
                  <p className="text-sm text-text-secondary">{email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5" /> Clinic
                  </label>
                  <input
                    type="text"
                    value={clinic}
                    onChange={(e) => setClinic(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="Clinique Atlas"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/20"
                    placeholder="+212 6XX-XXXXXX"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* AI Configuration */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">AI Configuration</h2>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">AI Call Language</p>
                    <p className="text-xs text-text-tertiary">Primary language for patient calls</p>
                  </div>
                </div>
                <select className="h-9 px-3 rounded-lg border border-border text-sm bg-white">
                  <option>Darija (Moroccan Arabic)</option>
                  <option>Standard Arabic</option>
                  <option>French</option>
                </select>
              </div>

              <div className="border-t border-border pt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">Auto-Translation</p>
                    <p className="text-xs text-text-tertiary">Show English translations in transcripts</p>
                  </div>
                </div>
                <div className="w-11 h-6 rounded-full bg-accent relative cursor-pointer">
                  <div className="absolute right-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow" />
                </div>
              </div>

              <div className="border-t border-border pt-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">Alert Notifications</p>
                    <p className="text-xs text-text-tertiary">Get notified for critical alerts</p>
                  </div>
                </div>
                <div className="w-11 h-6 rounded-full bg-accent relative cursor-pointer">
                  <div className="absolute right-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow" />
                </div>
              </div>
            </div>
          </section>

          {/* Call Schedule */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Default Call Schedule</h2>
            <div className="bg-card rounded-xl border border-border p-6">
              <p className="text-sm text-text-secondary mb-4">
                Automatic check-in calls are scheduled on these intervals:
              </p>
              <div className="flex gap-3">
                {[1, 2, 3, 4, 6, 8, 12].map((week) => (
                  <div
                    key={week}
                    className="w-14 h-14 rounded-xl bg-accent-light flex flex-col items-center justify-center"
                  >
                    <span className="text-lg font-bold text-accent">{week}</span>
                    <span className="text-[10px] text-text-tertiary">week</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
