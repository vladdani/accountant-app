import { FeaturesSectionWithHoverEffects } from "@/components/blocks/feature-section-with-hover-effects";

const whyCariNota = [
  {
    icon: "📦",
    title: "Never Lose a Receipt Again",
    description:
      "CariNota instantly organizes every uploaded invoice, receipt, and document—so you can find exactly what you need, months later, without digging through folders.",
  },
  {
    icon: "⏱️",
    title: "Save Hours Every Week",
    description:
      "Stop wasting time looking for old transactions. Just ask in plain language—\"Invoices from January over Rp 5 million\"—and get answers in seconds.",
  },
  {
    icon: "🔐",
    title: "Feel Ready for Any Audit",
    description:
      "Export a clean, organized list of transactions with full documentation attached. Your books are always audit-ready—no last-minute panic.",
  },
  {
    icon: "📲",
    title: "Send Files on WhatsApp, Forget About It",
    description:
      "Forward bills and invoices to CariNota's WhatsApp number. They'll be filed, tagged, and searchable—without logging in.",
  },
  {
    icon: "🔎",
    title: "Find Anything, in Any Language",
    description:
      "CariNota understands both English and Indonesian. Ask about supplier names, dates, amounts, or document types—in your words.",
  },
  {
    icon: "🧾",
    title: "Know What Was Spent, When, and on What",
    description:
      "Instantly see how much you spent with a supplier last quarter. Or which purchases exceeded budget. All backed by real documents.",
  },
  {
    icon: "🔄",
    title: "Simple for Everyone",
    description:
      "No training needed. Just upload your documents—admins, accountants, and owners can use it right away.",
  },
  {
    icon: "🇮🇩",
    title: "Built for Indonesian Businesses",
    description:
      "CariNota is designed for local formats, taxes, compliance rules, and your way of working—not adapted from a foreign system.",
  },
];

export function WhyCariNota() {
  return (
    <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted/40">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl text-foreground">
              Why CariNota?
            </h2>
            <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
              Stop drowning in paperwork. CariNota simplifies document management so you can focus on growing your business.
            </p>
          </div>
        </div>
        <FeaturesSectionWithHoverEffects 
          title="Why CariNota?" 
          description="Stop drowning in paperwork. CariNota simplifies document management so you can focus on growing your business."
          features={whyCariNota} 
        />
      </div>
    </section>
  );
} 