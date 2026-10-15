import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ScrollText } from "lucide-react";
import {
  isTermsEnabled,
  TERMS_LAST_UPDATED,
  TERMS_SECTIONS,
  type TermsBlock,
} from "@/lib/terms";

export const metadata = {
  title: "Bases y condiciones · HABA",
};

function Block({ block }: { block: TermsBlock }) {
  if (typeof block === "string") {
    return <p className="text-sm text-neutral-700 leading-relaxed">{block}</p>;
  }
  if ("subtitle" in block) {
    return (
      <h3 className="font-display text-sm font-bold text-[#1F7A4C] pt-2">{block.subtitle}</h3>
    );
  }
  return (
    <ul className="list-disc pl-5 space-y-1 marker:text-[#3BB578]">
      {block.list.map((item, i) => (
        <li key={i} className="text-sm text-neutral-700 leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}

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
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#2B2B2B] leading-tight">
            Bases y condiciones de uso y contratación
          </h1>
        </div>
        {TERMS_LAST_UPDATED && (
          <p className="text-xs text-neutral-500 mb-6 ml-[52px]">
            Última actualización: {TERMS_LAST_UPDATED}
          </p>
        )}

        <nav aria-label="Índice" className="mb-8 p-4 rounded-2xl bg-[#F6F7F2] border border-[#EAF0E8]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">Índice</p>
          <ol className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
            {TERMS_SECTIONS.map((section, i) => (
              <li key={i}>
                <a
                  href={`#seccion-${i + 1}`}
                  className="text-xs text-[#1F7A4C] hover:underline leading-snug"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-7">
          {TERMS_SECTIONS.map((section, i) => (
            <section key={i} id={`seccion-${i + 1}`} className="scroll-mt-6">
              <h2 className="font-display text-base font-bold text-[#2B2B2B] mb-2">
                {section.title}
              </h2>
              <div className="space-y-2">
                {section.blocks.map((block, j) => (
                  <Block key={j} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
