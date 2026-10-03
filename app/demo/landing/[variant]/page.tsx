import { notFound } from "next/navigation";
import { LandingPage, type HeroVariant } from "../landing-page";

const VARIANTS: readonly HeroVariant[] = ["control", "outcome"];

/** Rewrite target for the landing-hero experiment: /demo/landing → /demo/landing/<variant>. */
export default async function DemoLandingVariant({ params }: PageProps<"/demo/landing/[variant]">) {
  const { variant } = await params;
  if (!VARIANTS.includes(variant as HeroVariant)) notFound();
  return <LandingPage hero={variant as HeroVariant} />;
}
