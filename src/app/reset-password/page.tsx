import ResetForm from "./reset-form";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return <ResetForm token={searchParams.token ?? ""} />;
}
