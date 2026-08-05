import { redirect } from "next/navigation";

export default function DocumentsPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/claims/${params.id}?tab=documents`);
}
