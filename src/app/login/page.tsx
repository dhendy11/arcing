"use client";

import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="page">
      <h1>arcing</h1>
      <LoginForm onSignedIn={() => router.push("/")} />
    </main>
  );
}
