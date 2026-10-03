import { LandingPage } from "./landing-page";

/**
 * Reached only when the proxy did not rewrite: the visitor is not enrolled in landing-hero, the
 * experiment is paused/finished, or the config could not be loaded. Everyone here sees the control.
 */
export default function DemoLandingFallback() {
  return <LandingPage hero="control" />;
}
