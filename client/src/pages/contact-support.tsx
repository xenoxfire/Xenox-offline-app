import { Link, useLocation } from "wouter";
import { ArrowLeft, MessageCircle, Send, ExternalLink, Phone, Mail, Globe, HeadphonesIcon } from "lucide-react";
import { useLang, t } from "@/lib/language";

export default function ContactSupport() {
  const [, navigate] = useLocation();
  const [lang] = useLang();

  const SUPPORT_LINKS = [
    {
      icon: Send,
      label: t("support.channel_label", lang),
      value: "Xenox Short Channel",
      description: t("support.channel_desc", lang),
      href: "https://t.me/+fBDyNuOVCAczYWQ1",
      color: "from-sky-500 to-sky-600",
      borderColor: "border-sky-500/30",
      bgColor: "bg-sky-500/10",
    },
    {
      icon: MessageCircle,
      label: t("support.support_label", lang),
      value: "@xenox_short_support",
      description: t("support.support_desc", lang),
      href: "https://t.me/xenox_short_support",
      color: "from-blue-500 to-blue-600",
      borderColor: "border-blue-500/30",
      bgColor: "bg-blue-500/10",
    },
  ];

  const FAQ_ITEMS = [
    { q: t("faq.q1", lang), a: t("faq.a1", lang) },
    { q: t("faq.q2", lang), a: t("faq.a2", lang) },
    { q: t("faq.q3", lang), a: t("faq.a3", lang) },
  ];

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
            style={{ background: "linear-gradient(135deg, #0369a1, #0ea5e9)" }}>
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black text-white leading-none">{t("support.title", lang)}</h1>
            <p className="text-[9px] tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Help & Support</p>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="rounded-xl bg-gradient-to-br from-sky-500/10 to-blue-600/10 border border-sky-500/20 p-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center mx-auto mb-3">
            <Send className="w-7 h-7 text-sky-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">{t("support.tg_title", lang)}</h2>
          <p className="text-sm text-white/50">{t("support.tg_desc", lang)}</p>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">{t("support.links_label", lang)}</p>
          {SUPPORT_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
                data-testid={`link-support-${link.label.replace(/\s/g, "-")}`}>
                <div className={`rounded-xl border ${link.borderColor} ${link.bgColor} p-4 flex items-center gap-4 hover-elevate transition-all cursor-pointer mb-3`}>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{link.label}</p>
                    <p className="text-xs text-sky-400 font-mono mt-0.5">{link.value}</p>
                    <p className="text-xs text-white/40 mt-0.5">{link.description}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/30 flex-shrink-0" />
                </div>
              </a>
            );
          })}
        </div>


        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">{t("support.faq_label", lang)}</p>
          <div className="space-y-2">
            {FAQ_ITEMS.map((item, idx) => (
              <div key={idx} data-testid={`faq-item-${idx}`}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-xs font-semibold text-white mb-1.5">{item.q}</p>
                <p className="text-xs text-white/50 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">{t("support.other", lang)}</p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <Phone className="w-3.5 h-3.5 text-white/40" />
              </div>
              <div>
                <p className="text-xs text-white/60">{t("support.hours_label", lang)}</p>
                <p className="text-xs text-white/30">{t("support.hours_val", lang)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <Mail className="w-3.5 h-3.5 text-white/40" />
              </div>
              <div>
                <p className="text-xs text-white/60">{t("support.response_label", lang)}</p>
                <p className="text-xs text-white/30">{t("support.response_val", lang)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-white/40" />
              </div>
              <div>
                <p className="text-xs text-white/60">{t("support.version_label", lang)}</p>
                <p className="text-xs text-white/30">Xenox Short v1.0</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
