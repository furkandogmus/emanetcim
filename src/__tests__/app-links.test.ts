import { describe, expect, it } from "vitest";

import { appleAppSiteAssociation, assetLinks } from "@/lib/app-links";

const FP = Array.from({ length: 32 }, () => "AB").join(":");

describe("app links", () => {
  it("parmak izi yoksa assetlinks yayinlanmaz", () => {
    expect(assetLinks({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(assetLinks({ ANDROID_APP_LINK_SHA256: "bozuk" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("gecerli parmak izleriyle com.bagajpark icin yayinlanir", () => {
    const body = assetLinks({ ANDROID_APP_LINK_SHA256: `${FP.toLowerCase()}, ${FP}` } as unknown as NodeJS.ProcessEnv);
    expect(body?.[0].target).toEqual({ namespace: "android_app", package_name: "com.bagajpark", sha256_cert_fingerprints: [FP, FP] });
  });

  it("Team ID yoksa AASA yayinlanmaz; varsa yalnizca dukkan yolu", () => {
    expect(appleAppSiteAssociation({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    const body = appleAppSiteAssociation({ APPLE_TEAM_ID: "ABCDE12345" } as unknown as NodeJS.ProcessEnv);
    expect(body?.applinks.details[0].appIDs).toEqual(["ABCDE12345.com.bagajpark"]);
    expect(body?.applinks.details[0].components).toEqual([{ "/": "/*/shop/*" }]);
  });
});
