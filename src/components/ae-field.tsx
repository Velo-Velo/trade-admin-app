"use client";

import { useState } from "react";
import { inputClass, labelClass } from "./styles";
import { formatMiles, type AeSuggestion } from "@/lib/rams/ae";

export function AeField({
  defaultValue,
  suggestions,
  unavailable,
}: {
  defaultValue: string;
  suggestions: AeSuggestion[];
  unavailable: string;
}) {
  const [value, setValue] = useState(defaultValue || suggestions[0]?.name || "");
  return (
    <div className="grid gap-2">
      <label className={labelClass}>
        Nearest A&E
        <input className={inputClass} name="nearestHospital" value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <p className="text-sm leading-6 text-muted">
        Suggestion only, from the site postcode. Check this is the right 24-hour A&E before work starts. You can type a different hospital.
      </p>
      {suggestions.length > 0 ? (
        <ul className="grid gap-2">
          {suggestions.map((hospital, index) => (
            <li key={hospital.name}>
              <button
                type="button"
                className="w-full rounded-md border border-sand bg-white px-3 py-3 text-left text-sm"
                onClick={() => setValue(hospital.name)}
              >
                <span className="font-semibold">{index === 0 ? "Nearest: " : "Also nearby: "}{hospital.name}</span>
                <span className="mt-1 block text-muted">
                  {formatMiles(hospital.distanceMiles)}
                  {hospital.address ? ` · ${hospital.address}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{unavailable || "Type the hospital for this site."}</p>
      )}
    </div>
  );
}
