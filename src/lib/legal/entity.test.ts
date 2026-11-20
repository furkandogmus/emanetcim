import { describe, it, expect } from "vitest";
import { getLegalEntity, legalEntityDisplay, LEGAL_ENTITY_PLACEHOLDERS } from "./entity";

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe("legal entity", () => {
  it("uretimde bos alan cizilmez, gelistirmede yer tutucu gosterilir", () => {
    const entity = getLegalEntity(env({}));
    expect(legalEntityDisplay(entity, "mersisNo", env({ NODE_ENV: "production" }))).toBeNull();
    expect(legalEntityDisplay(entity, "mersisNo", env({ NODE_ENV: "development" }))).toBe(
      LEGAL_ENTITY_PLACEHOLDERS.mersisNo,
    );
  });

  it("dolu alan her ortamda kendisi olarak cizilir", () => {
    const entity = getLegalEntity(env({ NEXT_PUBLIC_COMPANY_LEGAL_NAME: "  Ornek A.S.  " }));
    expect(legalEntityDisplay(entity, "legalName", env({ NODE_ENV: "production" }))).toBe("Ornek A.S.");
  });

  it("KVKK adresi tanimsizsa destek adresine duser, hic bos kalmaz", () => {
    expect(getLegalEntity(env({})).dataRequestEmail).toMatch(/@/);
    expect(getLegalEntity(env({ NEXT_PUBLIC_KVKK_EMAIL: "kvkk@example.com" })).dataRequestEmail).toBe(
      "kvkk@example.com",
    );
  });
});
