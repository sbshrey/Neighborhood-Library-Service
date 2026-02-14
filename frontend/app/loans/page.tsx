"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoansRouteAlias() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return null;
}
