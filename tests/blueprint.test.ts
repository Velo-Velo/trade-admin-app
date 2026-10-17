import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type EnvVar = { key?: string; fromDatabase?: { name?: string; property?: string }; sync?: boolean; value?: string };
type Service = { type?: string; name?: string; runtime?: string; plan?: string; schedule?: string; envVars?: EnvVar[]; healthCheckPath?: string; buildCommand?: string; startCommand?: string };

describe("render blueprint", () => {
  const raw = readFileSync(new URL("../render.yaml", import.meta.url), "utf8");
  const blueprint = parse(raw) as { services: Service[]; databases: Array<{ name?: string; plan?: string; region?: string }> };

  it("defines a free node web service and free Postgres, with no paid cron", () => {
    expect(raw.toLowerCase()).not.toContain("vercel");
    const web = blueprint.services.find((service) => service.type === "web");
    expect(blueprint.services.some((service) => service.type === "cron")).toBe(false);
    expect(web?.runtime).toBe("node");
    expect(web?.plan).toBe("free");
    expect(web?.healthCheckPath).toBe("/api/health");
    expect(web?.buildCommand).toContain("prisma generate");
    expect(web?.startCommand).toBe("npm start");
    expect(blueprint.databases[0]?.name).toBe("quotestick-db");
    expect(blueprint.databases[0]?.region).toBe("frankfurt");
    expect(blueprint.databases[0]?.plan).toBe("free");

    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      scripts: { start: string };
    };
    expect(pkg.scripts.start).toContain("prisma migrate deploy");
    expect(pkg.scripts.start).toContain("tsx scripts/demo-on-start.ts");
    expect(pkg.scripts.start).toContain("next start");
    const hook = readFileSync(new URL("../scripts/demo-on-start.ts", import.meta.url), "utf8");
    expect(hook).toContain("demoModeEnabled");
    expect(hook).toContain("Sample trader left unchanged");

    const optional = parse(readFileSync(new URL("../render.cron.yaml", import.meta.url), "utf8")) as {
      services: Service[];
    };
    expect(optional.services[0]?.type).toBe("cron");
    expect(optional.services[0]?.schedule).toBe("0 8 * * *");
    expect(optional.services[0]?.startCommand).toContain("reminders");
    expect(optional.services[0]?.plan).toBe("0.5c-512mb");
  });

  it("wires DATABASE_URL from the database and lists every env example key", () => {
    const web = blueprint.services.find((service) => service.type === "web");
    const databaseUrl = web?.envVars?.find((item) => item.key === "DATABASE_URL");
    expect(databaseUrl?.fromDatabase).toEqual({ name: "quotestick-db", property: "connectionString" });
    const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
    const keys = [...example.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]);
    const rendered = new Set((web?.envVars ?? []).map((item) => item.key));
    for (const key of keys) {
      expect(rendered.has(key), key).toBe(true);
    }
    expect(web?.envVars?.find((item) => item.key === "SHOW_DEV_LINKS")?.value).toBe("false");
    expect(web?.envVars?.find((item) => item.key === "DEMO_MODE")?.value).toBe("false");
  });
});
