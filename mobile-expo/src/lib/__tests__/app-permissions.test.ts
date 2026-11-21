import { describe, expect, it } from "@jest/globals";

import appJson from "../../../app.json";

type Plugin = string | [string, Record<string, unknown>];

/*
  expo-image-picker'da `cameraPermission: false`, Android'de CAMERA'yi
  blockedPermissions'a ekler ve expo-camera'nin iznini de manifestten siler:
  esnaf QR okutamaz, ayarlarda kamera izni hic gorunmez. 0.3.3 bu yuzden cikti
  ve bir sonraki duzenlemede ayni satir geri gelmisti.
*/
describe("app.json izinleri", () => {
  const plugins = appJson.expo.plugins as Plugin[];
  const options = (name: string) =>
    (plugins.find((p) => Array.isArray(p) && p[0] === name) as [string, Record<string, unknown>] | undefined)?.[1];

  it("image-picker kamera iznini engellemez", () => {
    expect(options("expo-image-picker")?.cameraPermission).not.toBe(false);
  });

  it("CAMERA engellenen izinlerde degil", () => {
    expect(appJson.expo.android.blockedPermissions ?? []).not.toContain("android.permission.CAMERA");
  });
});
