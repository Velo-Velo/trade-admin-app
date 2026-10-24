"use client";

import { useState } from "react";
import { inputClass, labelClass } from "@/components/styles";
import { LIKELIHOOD, SEVERITY, riskBand, riskBandTone, riskScore } from "@/lib/rams/risk";

export function RiskPair({
  form,
  legend,
  likelihoodName,
  severityName,
  likelihood,
  severity,
}: {
  form: string;
  legend: string;
  likelihoodName: string;
  severityName: string;
  likelihood: number;
  severity: number;
}) {
  const [chance, setChance] = useState(likelihood);
  const [harm, setHarm] = useState(severity);
  const score = riskScore(chance, harm);
  const band = riskBand(score);
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={labelClass}>
          Likelihood
          <select
            className={inputClass}
            form={form}
            name={likelihoodName}
            value={chance}
            onChange={(event) => setChance(Number(event.target.value))}
          >
            {LIKELIHOOD.map((item) => (
              <option key={item.value} value={item.value}>
                {item.value} · {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Severity
          <select
            className={inputClass}
            form={form}
            name={severityName}
            value={harm}
            onChange={(event) => setHarm(Number(event.target.value))}
          >
            {SEVERITY.map((item) => (
              <option key={item.value} value={item.value}>
                {item.value} · {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm">
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${riskBandTone(band.label)}`}>
          {score} · {band.label}
        </span>
        <span className="ml-2 text-muted">{band.meaning}</span>
      </p>
    </fieldset>
  );
}
