import { Suspense } from "react";
import { AuthErrorContent } from "./AuthErrorContent";

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-400 text-sm font-medium">
          …
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
