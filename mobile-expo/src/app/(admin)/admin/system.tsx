import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AdminOpsScreen, SectionTitle, opsStyles } from "@/components/AdminOps";
import { TonePill } from "@/components/TonePill";
import { AppText, Banner, Card } from "@/components/ui";
import { installedBinaryVersion, isBelowMinVersion } from "@/lib/app-update";
import { checkTone, jobTone, systemHeadline, type Tone } from "@/lib/admin-system";
import { formatDayTime } from "@/lib/format";
import { useAdminSystem } from "@/lib/queries";
import type { AdminJobRun, AdminSystem, AdminSystemJob } from "@/lib/types";
import { colors, fonts, space } from "@/theme/tokens";


/**
 * Sistem (salt okuma): web `/admin/status` + `/admin/jobs` tek ekranda. Gecikmis is
 * saglik skorundan once gelir: slot uretimi 37 gun durdugunda skor yesildi.
 */
export default function AdminSystemScreen() {
  const { t } = useTranslation();
  const query = useAdminSystem();
  return (
    <AdminOpsScreen title={t("adminSystem.title")} query={query}>
      {query.data ? <Body data={query.data} /> : null}
    </AdminOpsScreen>
  );
}

function Body({ data }: { data: AdminSystem }) {
  const { t } = useTranslation();
  const level = systemHeadline(data);
  const installed = installedBinaryVersion();
  const behind = isBelowMinVersion(installed, data.appVersions.latest);

  return (
    <>
      <Card style={{ gap: space.md }}>
        <View style={opsStyles.rowTop}>
          <AppText variant="heading" style={{ flex: 1 }}>
            {t(`adminSystem.level.${level}`)}
          </AppText>
          <AppText style={styles.score}>{data.healthScore}/100</AppText>
        </View>
        <AppText variant="caption" style={{ fontSize: 13 }}>
          {t("adminSystem.checkedAt", { date: formatDayTime(data.checkedAt) })}
        </AppText>
        <View style={{ gap: space.sm }}>
          <CheckRow label={t("adminSystem.checks.database")} tone={checkTone(data.checks.database)} state={data.checks.database} />
          <CheckRow label={t("adminSystem.checks.email")} tone={checkTone(data.checks.email)} state={data.checks.email} />
          <CheckRow label={t("adminSystem.checks.sms")} tone={checkTone(data.checks.sms, true)} state={data.checks.sms} />
          <CheckRow label={t("adminSystem.checks.authSecret")} tone={checkTone(data.checks.authSecret)} state={data.checks.authSecret} />
        </View>
      </Card>

      <Card style={{ gap: space.sm }}>
        <SectionTitle>{t("adminSystem.versionsTitle")}</SectionTitle>
        <KeyValue label={t("adminSystem.serverVersion")} value={data.serverVersion} />
        <KeyValue label={t("adminSystem.appInstalled")} value={installed ?? "—"} />
        <KeyValue label={t("adminSystem.appLatest")} value={data.appVersions.latest ?? "—"} />
        <KeyValue label={t("adminSystem.appMin")} value={data.appVersions.min ?? "—"} />
        {behind ? <Banner tone="warning" body={t("adminSystem.appBehind")} /> : null}
      </Card>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t("adminSystem.jobsTitle")}</SectionTitle>
        {data.enforcedStale > 0 ? (
          <Banner tone="danger" title={t("adminSystem.jobsStaleTitle")} body={t("adminSystem.jobsStale", { count: data.enforcedStale })} />
        ) : (
          <AppText variant="caption" style={{ fontSize: 13 }}>
            {t("adminSystem.jobsOk")}
          </AppText>
        )}
        {data.jobs.map((j) => (
          <JobRow key={j.job} job={j} />
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{t("adminSystem.runsTitle")}</SectionTitle>
        {data.runs.length === 0 ? (
          <AppText variant="caption">{t("adminSystem.runsEmpty")}</AppText>
        ) : (
          data.runs.map((r) => <RunRow key={r.id} run={r} />)
        )}
      </View>

      <Card style={{ gap: space.sm }}>
        <SectionTitle>{t("adminSystem.runtimeTitle")}</SectionTitle>
        <KeyValue label="Node" value={data.runtime.node} />
        <KeyValue label="Next.js" value={data.runtime.next} />
        <KeyValue label={t("adminSystem.memory")} value={`${data.runtime.heapUsedMb} / ${data.runtime.heapTotalMb} MB`} />
        <KeyValue
          label={t("adminSystem.mode")}
          value={data.runtime.production ? t("adminSystem.modeProduction") : t("adminSystem.modeDevelopment")}
        />
        {data.emailFrom ? <KeyValue label={t("adminSystem.emailFrom")} value={data.emailFrom} /> : null}
      </Card>
    </>
  );
}

function CheckRow({ label, tone, state }: { label: string; tone: Tone; state: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.kv}>
      <AppText variant="body" style={{ flex: 1 }}>
        {label}
      </AppText>
      <TonePill tone={tone} label={t(`adminSystem.state.${state}`)} />
    </View>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <AppText variant="caption" style={{ flex: 1 }}>
        {label}
      </AppText>
      <AppText variant="mono" numberOfLines={1} style={{ flexShrink: 1, fontSize: 13 }}>
        {value}
      </AppText>
    </View>
  );
}

function JobRow({ job: j }: { job: AdminSystemJob }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const tone = jobTone(j);
  const label =
    j.status === "ok" ? t("adminSystem.jobOk") : j.enforced ? t(`adminSystem.job.${j.status}`) : t("adminSystem.jobPending");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((v) => !v)}
      style={({ pressed }) => [opsStyles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={opsStyles.rowTop}>
        <AppText variant="mono" style={{ flex: 1 }} numberOfLines={1}>
          {j.job}
        </AppText>
        <TonePill tone={tone} label={label} />
      </View>
      <AppText variant="caption" style={opsStyles.meta}>
        {j.lastSuccessAt
          ? t("adminSystem.lastSuccess", { date: formatDayTime(j.lastSuccessAt), hours: j.hoursSinceSuccess ?? 0 })
          : t("adminSystem.neverSucceeded")}
      </AppText>
      {open ? (
        <View style={{ gap: 4, paddingTop: space.xs }}>
          <AppText variant="caption">{j.what}</AppText>
          {j.ifItStops ? (
            <AppText variant="caption">
              {t("adminSystem.ifItStops")}: {j.ifItStops}
            </AppText>
          ) : null}
          <AppText variant="caption" style={opsStyles.meta}>
            {t("adminSystem.schedule", { cron: j.cron, hours: j.maxStaleHours })}
          </AppText>
          {j.lastRunAt ? (
            <AppText variant="caption" style={opsStyles.meta}>
              {t("adminSystem.lastRun", { date: formatDayTime(j.lastRunAt), status: j.lastRunStatus ?? "—" })}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function RunRow({ run: r }: { run: AdminJobRun }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const tone: Tone = r.status === "SUCCESS" ? "ok" : r.status === "FAILED" ? "danger" : "muted";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      disabled={!r.detail}
      onPress={() => setOpen((v) => !v)}
      style={({ pressed }) => [opsStyles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={opsStyles.rowTop}>
        <AppText variant="mono" style={{ flex: 1 }} numberOfLines={1}>
          {r.job}
        </AppText>
        <TonePill tone={tone} label={t(`adminSystem.run.${r.status}`, { defaultValue: r.status })} />
      </View>
      <AppText variant="caption" style={opsStyles.meta}>
        {[formatDayTime(r.startedAt), r.durationMs != null ? t("adminSystem.duration", { s: (r.durationMs / 1000).toFixed(1) }) : null]
          .filter(Boolean)
          .join(" · ")}
      </AppText>
      {open && r.detail ? (
        <AppText variant="mono" style={{ fontSize: 12, lineHeight: 16 }}>
          {r.detail}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  score: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink, fontVariant: ["tabular-nums"] },
  kv: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 28 },
});
