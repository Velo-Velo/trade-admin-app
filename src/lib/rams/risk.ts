/** 5×5 likelihood × severity. The score is the product. */

export const LIKELIHOOD = [
  { value: 1, label: "Rare" },
  { value: 2, label: "Unlikely" },
  { value: 3, label: "Possible" },
  { value: 4, label: "Likely" },
  { value: 5, label: "Almost certain" },
] as const;

export const SEVERITY = [
  { value: 1, label: "Negligible" },
  { value: 2, label: "Minor" },
  { value: 3, label: "Moderate" },
  { value: 4, label: "Major" },
  { value: 5, label: "Fatal" },
] as const;

export type RiskBandLabel = "Low" | "Medium" | "High" | "Very high";

export type RiskBand = {
  label: RiskBandLabel;
  /** What the band means for the person checking the RAMS. */
  meaning: string;
};

export function clampScorePart(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(5, Math.max(1, Math.round(value)));
}

export function riskScore(likelihood: number, severity: number): number {
  return clampScorePart(likelihood) * clampScorePart(severity);
}

export function riskBand(score: number): RiskBand {
  if (score <= 4) {
    return { label: "Low", meaning: "Acceptable while the controls stay in place." };
  }
  if (score <= 9) {
    return { label: "Medium", meaning: "Go ahead only with the controls in this RAMS." };
  }
  if (score <= 15) {
    return {
      label: "High",
      meaning: "The competent person accepts the residual risk in writing, or adds controls before work starts.",
    };
  }
  return { label: "Very high", meaning: "Do not start. Change the method until the rating comes down." };
}

export function riskBandTone(label: RiskBandLabel): string {
  if (label === "Low") return "bg-emerald-100 text-emerald-950";
  if (label === "Medium") return "bg-amber-100 text-amber-950";
  if (label === "High") return "bg-orange-100 text-orange-950";
  return "bg-red-100 text-red-950";
}

export const RISK_KEY =
  "Score = likelihood × severity. 1–4 Low, 5–9 Medium, 10–15 High, 16–25 Very high. Severity is how bad the harm would be. Likelihood is how likely that harm is on this job, before and after the controls.";
