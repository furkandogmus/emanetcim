import { Redirect } from "expo-router";

import { useAuth } from "@/lib/auth";

/** Capa rota: oturuma ve role gore dogru gruba yonlendirir. */
export default function Index() {
  const { state } = useAuth();
  if (state.status !== "signedIn") return <Redirect href="/login" />;
  if (state.user.role === "PARTNER") return <Redirect href="/partner" />;
  return <Redirect href="/home" />;
}
