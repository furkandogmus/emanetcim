interface WebkitWindow extends Window {
  webkit?: {
    messageHandlers?: Record<string, { postMessage?: (msg: string) => void }>;
  };
}

const IS_IOS =
  typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

function iosHaptic(type: string) {
  try {
    (window as WebkitWindow).webkit?.messageHandlers?.haptic?.postMessage?.(type);
  } catch { /* noop */ }
}

export function hapticLight() {
  if (typeof navigator === "undefined") return;
  if (IS_IOS) iosHaptic("light");
  navigator.vibrate?.(10);
}

export function hapticMedium() {
  if (typeof navigator === "undefined") return;
  if (IS_IOS) iosHaptic("medium");
  navigator.vibrate?.(20);
}

export function hapticHeavy() {
  if (typeof navigator === "undefined") return;
  if (IS_IOS) iosHaptic("heavy");
  navigator.vibrate?.(40);
}

export function hapticSuccess() {
  if (typeof navigator === "undefined") return;
  if (IS_IOS) iosHaptic("success");
  navigator.vibrate?.([10, 50, 10]);
}

export function hapticError() {
  if (typeof navigator === "undefined") return;
  if (IS_IOS) iosHaptic("error");
  navigator.vibrate?.([30, 50, 30]);
}
