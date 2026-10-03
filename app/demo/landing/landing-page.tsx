import { getFlag, getVariant } from "@/lib/sdk/server";
import { CtaButton } from "./cta-button";
import { PromoBanner } from "./promo-banner";

export type HeroVariant = "control" | "outcome";

const HERO: Record<HeroVariant, { eyebrow: string; title: string; body: string; cta: string; accent: boolean }> = {
  control: {
    eyebrow: "Invoicing for freelancers",
    title: "Invoices, expenses and reports in one place",
    body: "Create invoices, record expenses, see what has been paid and export a clean report for your accountant at the end of the month.",
    cta: "Start free trial",
    accent: false,
  },
  outcome: {
    eyebrow: "Invoicing for freelancers",
    title: "Get paid for your work without chasing clients",
    body: "Send an invoice in a couple of minutes, let clients pay by card or bank transfer, and let Ledgerline send the polite reminder when a payment is late.",
    cta: "Send my first invoice",
    accent: true,
  },
};

const FEATURES = [
  { title: "Payment links on every invoice", body: "Clients pay by card or bank transfer from the invoice itself. Paid invoices are marked automatically." },
  { title: "Reminders you don't have to write", body: "Pick a schedule once. Ledgerline emails a reminder 3, 7 and 14 days after the due date." },
  { title: "Month-end export", body: "One CSV with invoices, payments and expenses, in the format most accountants ask for." },
];

/** Fictional studio names for the social-proof variant. This is a demo page, not a real product. */
const LOGOS = ["Studio Pampa", "Fernweh Design", "Okta Atelier", "Monday Pixels", "Caju Films"];

export async function LandingPage({ hero }: { hero: HeroVariant }) {
  const copy = HERO[hero];
  const [socialProof, newPricing] = await Promise.all([getVariant("social-proof"), getFlag("new-pricing-table")]);

  return (
    <div className="pb-24" data-testid={`landing-${hero}`}>
      <PromoBanner />
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-lg font-semibold tracking-tight">Ledgerline</span>
        <span className="rounded-full border border-[#e4e1dc] px-2.5 py-0.5 text-xs text-[#6b6f76]">Demo product</span>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-14 pt-10 sm:pt-16">
        <p className="text-sm font-medium text-[#6b6f76]">{copy.eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl" data-testid="hero-title">
          {copy.title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#4a4e55]">{copy.body}</p>
        <div className="mt-8">
          <CtaButton label={copy.cta} accent={copy.accent} note="14 days free. No card required." />
        </div>
      </section>

      {socialProof === "logos" && (
        <section aria-label="Studios using Ledgerline" className="border-y border-[#ebe8e3] bg-white" data-testid="social-proof">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-10 gap-y-3 px-5 py-6 text-sm font-semibold text-[#6b6f76]">
            <span className="text-xs font-normal uppercase tracking-wide">Used by small studios like</span>
            {LOGOS.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-5xl gap-6 px-5 py-14 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title}>
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#4a4e55]">{f.body}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="pricing" className="mx-auto max-w-5xl px-5 py-10">
        <h2 id="pricing" className="text-2xl font-semibold tracking-tight">
          Pricing
        </h2>
        {newPricing ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-3" data-testid="pricing-new">
            {[
              ["Solo", "$9", "Unlimited invoices, 1 user"],
              ["Studio", "$19", "Up to 5 users, client portal"],
              ["Agency", "$39", "Unlimited users, custom domain"],
            ].map(([name, price, desc]) => (
              <div key={name} className="rounded-lg border border-[#e4e1dc] bg-white p-5">
                <p className="font-medium">{name}</p>
                <p className="mt-2 text-3xl font-semibold">
                  {price}
                  <span className="text-sm font-normal text-[#6b6f76]">/mo</span>
                </p>
                <p className="mt-2 text-sm text-[#4a4e55]">{desc}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="pricing-old">
            {[
              ["Monthly", "$15/mo", "Everything included, cancel anytime"],
              ["Annual", "$150/yr", "Two months free compared to monthly"],
            ].map(([name, price, desc]) => (
              <div key={name} className="rounded-lg border border-[#e4e1dc] bg-white p-6">
                <p className="font-medium">{name}</p>
                <p className="mt-2 text-3xl font-semibold">{price}</p>
                <p className="mt-2 text-sm text-[#4a4e55]">{desc}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-[#6b6f76]">Pricing layout is controlled by the new-pricing-table flag.</p>
      </section>
    </div>
  );
}
