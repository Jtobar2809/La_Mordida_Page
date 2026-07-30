import { Suspense } from "react";
import RegisterContent from "./registro-content";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
