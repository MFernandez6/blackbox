"use client";

import { useRouter } from "next/navigation";
import { PersonForm } from "@/components/people/person-form";

export function NewPersonClient() {
  const router = useRouter();
  return (
    <PersonForm
      onSaved={(id) => router.push(`/people/${id}`)}
      onCancel={() => router.push("/people")}
    />
  );
}
