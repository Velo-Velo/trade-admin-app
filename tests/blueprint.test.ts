import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type EnvVar = { key?: string; fromDatabase?: { name?: string; property?: string }; sync?: boolean; value?: string };
type Service = { type?: string; name?: string; runtime?: string; plan?: string; schedule?: string; envVars?: EnvVar[]; healthCheckPath?: string; buildCommand?: string; startCommand?: string };

describe("render blueprint", () => {
  const raw = readFileSync(new URL("../render.yaml", import.meta.url), "utf8");
  const blueprint = parse(raw) as { services: Service[]; databases: Array<{ name?: string; plan?: string; region?: string }> };

  it("defines a node web service, a reminder cron, and Postgres", () => {
    expect(raw.toLowerCase()).not.toContain("vercel");
    const web = blueprint.services.find((service) => service.type === "web");
    const cron = blueprint.services.find((service) => service.type === "cron");
    expect(web?.runtime).toBe("node");
    expect(web?.healthCheckPath).toBe("/api/health");
    expect(web?.buildCommand).toContain("prisma generate");
    expect(web?.startCommand).toBe("npm start");
    expect(cron?.schedule).toBe("0 8 * * *");
    expect(cron?.startCommand).toContain("reminders");
    expect(blueprint.databases[0]?.name).toBe("quotestick-db");
    expect(blueprint.databases[0]?.region).toBe("frankfurt");
    expect(web?.plan).toBeTruthy();
    expect(blueprint.databases[0]?.plan).toBeTruthy();
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
  });
});
