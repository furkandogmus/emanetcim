import { appPathFromLink } from "@/lib/app-link-path";

/** Android App Links / iOS Universal Links: web yolunu uygulama ekranina cevirir. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return appPathFromLink(path);
}
