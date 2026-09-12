"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClientAlertsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/client");
  }, [router]);

  return null;
}
