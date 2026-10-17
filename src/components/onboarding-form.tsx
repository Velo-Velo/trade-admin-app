"use client";

import { useState } from "react";
import { completeOnboarding } from "@/server/business-actions";
import { foregroundFor } from "@/lib/brand";
import { SERVICE_PRESETS, TRADES, type TradeValue } from "@/lib/trades";
import { buttonPrimary, inputClass, labelClass } from "@/components/styles";

export function OnboardingForm() {
  const [trade, setTrade] = useState<TradeValue>("PLUMBING_HEATING");
  const [services, setServices] = useState(SERVICE_PRESETS.PLUMBING_HEATING);
  const [servicesTouched, setServicesTouched] = useState(false);
  const [logo, setLogo] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [colour, setColour] = useState("#1f4a38");

  return (
    <form action={completeOnboarding} className="grid gap-5">
      <label className={labelClass}>
        Business name
        <input
          className={inputClass}
          name="businessName"
          required
          maxLength={80}
          value={businessName}
          onChange={(event) => {
            const next = event.target.value;
            setBusinessName(next);
            if (!logo || logo === businessName) setLogo(next);
          }}
        />
      </label>
      <label className={labelClass}>
        Trade
        <select
          className={inputClass}
          name="trade"
          value={trade}
          onChange={(event) => {
            const next = event.target.value as TradeValue;
            setTrade(next);
            if (!servicesTouched) setServices(SERVICE_PRESETS[next]);
          }}
        >
          {TRADES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Area you cover
        <input className={inputClass} name="area" required maxLength={120} placeholder="Towns and cities you cover" />
      </label>
      <label className={labelClass}>
        Postcodes
        <input className={inputClass} name="postcodes" required maxLength={200} placeholder="Postcode districts you cover" />
      </label>
      <label className={labelClass}>
        Phone
        <input className={inputClass} name="phone" required inputMode="tel" autoComplete="tel" placeholder="07700 900000" />
      </label>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className={labelClass}>
          Text logo
          <input
            className={inputClass}
            name="logoText"
            required
            maxLength={40}
            value={logo}
            onChange={(event) => setLogo(event.target.value)}
          />
        </label>
        <label className={labelClass}>
          Colour
          <input className={`${inputClass} h-12 w-full sm:w-24`} name="brandColour" type="color" value={colour} onChange={(event) => setColour(event.target.value)} />
        </label>
      </div>
      <p className="rounded-xl px-4 py-3 font-serif text-2xl" style={{ background: colour, color: foregroundFor(colour) }}>
        {logo || "Your logo"}
      </p>
      <label className={labelClass}>
        Services, one per line
        <textarea
          className={inputClass}
          name="services"
          required
          rows={5}
          value={services}
          onChange={(event) => {
            setServicesTouched(true);
            setServices(event.target.value);
          }}
        />
      </label>
      <label className={labelClass}>
        Short introduction (optional)
        <textarea className={inputClass} name="bio" rows={3} maxLength={800} placeholder="A sentence about the work you do." />
      </label>
      <button className={buttonPrimary} type="submit">
        Create my page
      </button>
    </form>
  );
}
