import { redirect } from "next/navigation";
import { getSession, canEdit } from "@/lib/auth";
import { FnolWizard } from "@/components/forms/fnol-wizard";

export default async function NewClaimPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canEdit(session.user.role)) redirect("/dashboard");

  return <FnolWizard />;
}
