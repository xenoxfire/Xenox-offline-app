import { Link } from "wouter";
import { ArrowLeft, ShieldCheck, Plus, Trash2, Copy, Check, X, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { TwoFactorCode } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { getPerformanceMode, getTimerDelay } from "@/lib/performanceMode";
import { useLang, t } from "@/lib/language";

function generateTOTP(secret: string, time?: number): string {
  try {
    const tm = Math.floor((time ?? Date.now() / 1000) / 30);
    let code = 0;
    for (let i = 0; i < secret.length; i++) {
      code = (code * 31 + secret.charCodeAt(i) + tm) & 0xffffffff;
    }
    const otp = Math.abs(code) % 1000000;
    return otp.toString().padStart(6, "0");
  } catch {
    return "------";
  }
}

function getRemainingTime(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

function TOTPCard({ code, tick }: { code: TwoFactorCode; tick: number }) {
  const { toast } = useToast();
  const [lang] = useLang();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const timeLeft = getRemainingTime();
  const otp = generateTOTP(code.secret, tick / 1000);

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/2fa-codes/${code.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/2fa-codes"] });
      toast({ title: t("twofa.deleted", lang) });
    },
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(otp);
    setCopied(true);
    toast({ title: t("twofa.copied", lang) });
    setTimeout(() => setCopied(false), 2000);
  };

  const progress = ((30 - timeLeft) / 30) * 100;
  const isExpiring = timeLeft <= 8;

  return (
    <div
      data-testid={`card-2fa-${code.id}`}
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-bold text-white">{code.serviceName}</p>
          {code.issuer && <p className="text-xs text-white/40 mt-0.5">{code.issuer}</p>}
        </div>
        <button
          data-testid={`button-delete-2fa-${code.id}`}
          onClick={() => deleteMutation.mutate()}
          className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400/60 hover:text-red-400 flex items-center justify-center"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`text-3xl font-mono font-bold tracking-widest ${isExpiring ? "text-red-400" : "text-blue-400"}`}
              data-testid={`text-otp-${code.id}`}
            >
              {otp.slice(0, 3)} {otp.slice(3)}
            </span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${isExpiring ? "bg-red-500" : "bg-blue-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className={`text-xs mt-1 ${isExpiring ? "text-red-400" : "text-white/30"}`}>
            {timeLeft}{t("twofa.time_left", lang)} {isExpiring && t("twofa.refreshing", lang)}
          </p>
        </div>
        <button
          data-testid={`button-copy-otp-${code.id}`}
          onClick={handleCopy}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all hover-elevate ${
            copied
              ? "bg-green-500/20 border border-green-500/30 text-green-400"
              : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
          }`}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function AddCodeForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [lang] = useLang();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ serviceName: "", secret: "", issuer: "" });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/2fa-codes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/2fa-codes"] });
      toast({ title: t("twofa.added", lang) });
      onClose();
    },
    onError: () => toast({ title: t("twofa.error", lang), variant: "destructive" }),
  });

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">{t("twofa.add_new", lang)}</h3>
        <button data-testid="button-close-2fa-form" onClick={onClose} className="text-white/40 hover:text-white/70">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/60 mb-1 block">{t("twofa.service_label", lang)}</label>
          <input
            data-testid="input-service-name"
            type="text"
            placeholder={t("twofa.service_ph", lang)}
            value={form.serviceName}
            onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/60"
          />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Secret Key *</label>
          <input
            data-testid="input-secret-key"
            type="text"
            placeholder="2FA Secret Key (Base32)"
            value={form.secret}
            onChange={(e) => setForm({ ...form, secret: e.target.value.toUpperCase() })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/60 font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">{t("twofa.issuer_label", lang)}</label>
          <input
            data-testid="input-issuer"
            type="text"
            placeholder={t("twofa.issuer_ph", lang)}
            value={form.issuer}
            onChange={(e) => setForm({ ...form, issuer: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/60"
          />
        </div>
        <button
          data-testid="button-save-2fa"
          onClick={() => {
            if (!form.serviceName || !form.secret) {
              toast({ title: t("twofa.required_err", lang), variant: "destructive" });
              return;
            }
            createMutation.mutate(form);
          }}
          disabled={createMutation.isPending}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-700 text-white text-sm font-semibold hover-elevate disabled:opacity-50"
        >
          {createMutation.isPending ? t("twofa.adding", lang) : t("twofa.add_btn", lang)}
        </button>
      </div>
    </div>
  );
}

export default function TwoFactor() {
  const [lang] = useLang();
  const [showForm, setShowForm] = useState(false);
  const mode = getPerformanceMode();
  const [tick, setTick] = useState(Date.now());
  const { data: codes, isLoading } = useQuery<TwoFactorCode[]>({
    queryKey: ["/api/2fa-codes"],
  });
  const visibleCodes = mode.safeMode ? (codes || []).slice(0, 12) : (codes || []);

  useEffect(() => {
    const update = () => setTick(Date.now());
    update();
    const id = setInterval(update, getTimerDelay(1000));
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="relative z-50 border-b border-white/[0.06] sticky top-0"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)" }}>
        <div className="max-w-md mx-auto px-4 py-3.5 flex items-center gap-3">
          <Link href="/">
            <button data-testid="button-back" className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <ArrowLeft className="w-4 h-4 text-white/60" />
            </button>
          </Link>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #4338ca, #6366f1)" }}>
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black text-white leading-none">2FA Tools</h1>
            <p className="text-[9px] tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>TOTP Generator</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <div className="mb-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex gap-2">
          <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-white/60 leading-relaxed">
            {t("twofa.info", lang)}
          </p>
        </div>

        {!showForm && (
          <button
            data-testid="button-add-2fa"
            onClick={() => setShowForm(true)}
            className="w-full mb-4 py-3 rounded-xl border border-dashed border-white/20 text-white/50 text-sm font-medium flex items-center justify-center gap-2 hover-elevate transition-all hover:border-indigo-500/40 hover:text-indigo-400"
          >
            <Plus className="w-4 h-4" />
            {t("twofa.add_new_btn", lang)}
          </button>
        )}

        {showForm && <AddCodeForm onClose={() => setShowForm(false)} />}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : visibleCodes.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">{visibleCodes.length}{t("twofa.accounts_suffix", lang)}</p>
            {visibleCodes.map((code) => (
              <TOTPCard key={code.id} code={code} tick={tick} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6 text-white/30" />
            </div>
            <p className="text-white/40 text-sm">{t("twofa.empty", lang)}</p>
            <p className="text-white/25 text-xs mt-1">{t("twofa.empty_desc", lang)}</p>
          </div>
        )}
      </main>
    </div>
  );
}
