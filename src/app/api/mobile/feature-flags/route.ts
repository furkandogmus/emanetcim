import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { featureFlagService } from "@/services/FeatureFlagService";
import { toMobileFeatureFlags } from "@/lib/mobile-dto";

/**
 * Kimlik doğrulama İSTEĞE BAĞLI: rollout yüzdesi ve izin listesi kullanıcı
 * kimliğine göre değerlendirilir, ama giriş öncesi ekranlar (onboarding,
 * login) da bir bayrağa bakabilmeli. Girişli istekte kullanıcıya özel
 * değerlendirme, girişsizde anonim (yalnızca %100 rollout'lar) değerlendirme.
 */
export async function GET(req: NextRequest) {
  const auth = await requireMobileUser(req);
  const userId = "error" in auth ? undefined : auth.user.id;

  const all = await featureFlagService.listAll();
  const flags: Record<string, boolean> = {};
  for (const flag of all) {
    flags[flag.key] = await featureFlagService.isEnabled(flag.key, { userId });
  }
  return NextResponse.json(toMobileFeatureFlags(flags));
}
