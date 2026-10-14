import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ScrollText } from "lucide-react";
import { isTermsEnabled, TERMS_LAST_UPDATED, TERMS_SECTIONS } from "@/lib/terms";

export const metadata = {
  title: "Bases y condiciones · HABA",
};

export default function TerminosPage() {
  if (!isTermsEnabled()) notFound();

  return (
    <main className="w-full max-w-2xl px-4 py-8 sm:py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1F7A4C] hover:underline mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver a HABA
      </Link>

      <div className="bg-white rounded-3xl border border-[#EAF0E8] shadow-sm p-5 sm:p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-[#DCF4D7] text-[#1F7A4C] flex items-center justify-center flex-shrink-0">
            <ScrollText className="w-5 h-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#2B2B2B]">Bases y condiciones</h1>
        </div>
        {TERMS_LAST_UPDATED && (
          <p className="text-xs text-neutral-500 mb-6 ml-[52px]">
            Última actualización: {TERMS_LAST_UPDATED}
          </p>
        )}

        <div className="space-y-6">
          {TERMS_SECTIONS.map((section, i) => (
            <section key={i}>
              <h2 className="font-display text-base font-bold text-[#2B2B2B] mb-2">
                {section.title}
              </h2>
              <div className="space-y-2">
                {section.paragraphs.map((p, j) => (
                  <p key={j} className="text-sm text-neutral-700 leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
