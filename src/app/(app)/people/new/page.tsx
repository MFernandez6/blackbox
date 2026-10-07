import Link from "next/link";
import { redirect } from "next/navigation";
import { canEdit, getSession } from "@/lib/auth";
import { NewPersonClient } from "@/components/people/new-person-client";

export default async function NewPersonPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canEdit(session.user.role)) redirect("/people");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/people" className="eyebrow hover:text-brand-gold">
          ← People
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-semibold tracking-[0.06em] text-brand-white">
          Add person
        </h1>
      </div>
      <NewPersonClient />
    </div>
  );
}
