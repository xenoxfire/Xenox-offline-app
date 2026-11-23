import { Link } from "wouter";
import { ArrowLeft, Database, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { LocalData } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useLang, t } from "@/lib/language";

const CATEGORIES = ["general", "email", "code", "note", "config"];

function AddDataForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [lang] = useLang();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ label: "", value: "", category: "general" });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/local-data", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/local-data"] });
      toast({ title: t("localdata.saved", lang) });
      onClose();
    },
    onError: () => toast({ title: t("localdata.error", lang), variant: "destructive" }),
  });

  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">{t("localdata.add_new", lang)}</h3>
        <button data-testid="button-close-add-form" onClick={onClose} className="text-white/40 hover:text-white/70">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/60 mb-1 block">{t("localdata.label_field", lang)}</label>
          <input
            data-testid="input-data-label"
            type="text"
            placeholder={t("localdata.label_ph", lang)}
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60"
          />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">{t("localdata.value_field", lang)}</label>
          <textarea
            data-testid="input-data-value"
            placeholder={t("localdata.value_ph", lang)}
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/60 resize-none"
          />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">{t("localdata.cat_field", lang)}</label>
          <select
            data-testid="select-data-category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/60"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-gray-900">{c}</option>
            ))}
          </select>
        </div>
        <button
          data-testid="button-save-data"
          onClick={() => {
            if (!form.label || !form.value) {
              toast({ title: t("localdata.required_err", lang), variant: "destructive" });
              return;
            }
            createMutation.mutate(form);
          }}
          disabled={createMutation.isPending}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm font-semibold hover-elevate disabled:opacity-50"
        >
          {createMutation.isPending ? t("localdata.saving", lang) : t("localdata.save_btn", lang)}
        </button>
      </div>
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  general: "text-white/50 bg-white/5 border-white/10",
  email: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  code: "text-green-400 bg-green-500/10 border-green-500/20",
  note: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  config: "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

export default function LocalData() {
  const { toast } = useToast();
  const [lang] = useLang();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const { data: items, isLoading } = useQuery<LocalData[]>({
    queryKey: ["/api/local-data"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/local-data/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/local-data"] });
      toast({ title: t("localdata.deleted", lang) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      apiRequest("PATCH", `/api/local-data/${id}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/local-data"] });
      setEditingId(null);
      toast({ title: t("localdata.updated", lang) });
    },
  });

  const filtered = items?.filter((i) => filterCat === "all" || i.category === filterCat) ?? [];

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
            style={{ background: "linear-gradient(135deg, #6d28d9, #8b5cf6)" }}>
            <Database className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black text-white leading-none">App Float Space</h1>
            <p className="text-[9px] tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Local Storage</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {["all", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              data-testid={`button-filter-${cat}`}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 border transition-all hover-elevate ${
                filterCat === cat
                  ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                  : "bg-white/[0.03] border-white/10 text-white/50"
              }`}
            >
              {cat === "all" ? t("localdata.filter_all", lang) : cat}
            </button>
          ))}
        </div>

        {!showForm && (
          <button
            data-testid="button-add-data"
            onClick={() => setShowForm(true)}
            className="w-full mb-4 py-3 rounded-xl border border-dashed border-white/20 text-white/50 text-sm font-medium flex items-center justify-center gap-2 hover-elevate transition-all hover:border-purple-500/40 hover:text-purple-400"
          >
            <Plus className="w-4 h-4" />
            {t("localdata.add_btn", lang)}
          </button>
        )}

        {showForm && <AddDataForm onClose={() => setShowForm(false)} />}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">
              {filtered.length}{t("localdata.items_suffix", lang)}
            </p>
            {filtered.map((item) => (
              <div
                key={item.id}
                data-testid={`card-data-${item.id}`}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[item.category ?? "general"] ?? CATEGORY_COLORS.general}`}>
                        {item.category}
                      </span>
                    </div>
                    {editingId === item.id ? (
                      <div className="flex gap-2 mt-1">
                        <textarea
                          data-testid={`input-edit-${item.id}`}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          rows={2}
                          className="flex-1 bg-white/5 border border-purple-500/30 rounded-lg px-2 py-1 text-xs text-white focus:outline-none resize-none"
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            data-testid={`button-save-edit-${item.id}`}
                            onClick={() => updateMutation.mutate({ id: item.id, value: editValue })}
                            className="w-6 h-6 rounded bg-green-500/20 text-green-400 flex items-center justify-center"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            data-testid={`button-cancel-edit-${item.id}`}
                            onClick={() => setEditingId(null)}
                            className="w-6 h-6 rounded bg-white/10 text-white/40 flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-white/50 break-all mt-0.5">{item.value}</p>
                    )}
                  </div>
                  {editingId !== item.id && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        data-testid={`button-edit-${item.id}`}
                        onClick={() => { setEditingId(item.id); setEditValue(item.value); }}
                        className="w-7 h-7 rounded-lg bg-white/5 text-white/40 hover:text-white/70 flex items-center justify-center"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        data-testid={`button-delete-data-${item.id}`}
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="w-7 h-7 rounded-lg bg-white/5 text-red-400/50 hover:text-red-400 flex items-center justify-center"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
              <Database className="w-6 h-6 text-white/30" />
            </div>
            <p className="text-white/40 text-sm">{t("localdata.empty", lang)}</p>
            <p className="text-white/25 text-xs mt-1">{t("localdata.empty_desc", lang)}</p>
          </div>
        )}
      </main>
    </div>
  );
}
