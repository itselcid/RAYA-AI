"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { authApi } from "@/lib/api";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = isRegister
        ? await authApi.register({ name, email, password, role: "doctor" })
        : await authApi.login(email, password);

      localStorage.setItem("raya_token", res.data.access_token);
      localStorage.setItem("raya_user", JSON.stringify(res.data.user));
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex flex-1 bg-sidebar flex-col items-center justify-center p-16 gap-10">
        <div className="flex items-center">
          <Logo size="lg" variant="light" />
        </div>

        <div className="text-center max-w-md space-y-4">
          <h2 className="text-3xl font-bold text-white">
            AI-Powered Patient Follow-up
          </h2>
          <p className="text-white/70 text-lg leading-relaxed">
            Automated AI follow-up calls in Darija for diabetes, Alzheimer's,
            chemotherapy, post-surgery &amp; more — any condition, any patient.
          </p>
        </div>

        <div className="flex gap-12 mt-4">
          {[
            { value: "96.8%", label: "Recovery Rate" },
            { value: "3,298", label: "Calls Made" },
            { value: "-42%", label: "Readmissions" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-white/60">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 lg:max-w-lg flex flex-col justify-center px-12 lg:px-16">
        <div className="lg:hidden flex items-center mb-10">
          <Logo size="md" variant="dark" />
        </div>

        <h1 className="text-3xl font-bold text-text-primary">
          {isRegister ? "Create account" : "Welcome back"}
        </h1>
        <p className="text-text-secondary mt-2 mb-8">
          {isRegister
            ? "Set up your RAYA dashboard"
            : "Sign in to your RAYA dashboard"}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error-light text-error text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegister && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                placeholder="Dr. Omar El Mansouri"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Email address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 pl-11 pr-4 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                placeholder="omar@cliniqueatlas.ma"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-text-primary">Password</label>
              {!isRegister && (
                <button type="button" className="text-sm font-medium text-accent hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-11 pr-11 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-text-tertiary" />
                ) : (
                  <Eye className="w-4 h-4 text-text-tertiary" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-accent text-white font-semibold flex items-center justify-center gap-2 hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : isRegister ? "Create account" : "Sign in"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <p className="mt-6 text-sm text-text-secondary text-center">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="font-medium text-accent hover:underline"
          >
            {isRegister ? "Sign in" : "Contact sales"}
          </button>
        </p>
      </div>
    </div>
  );
}
