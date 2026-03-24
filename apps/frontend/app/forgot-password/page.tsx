import ForgotPasswordForm from "@/components/ForgotPasswordForm";
import { LABEL_BACK_TO_LOGIN } from "@/constants/labels";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset password</h1>
        <ForgotPasswordForm />
        <p className="text-sm text-center text-gray-500 mt-6">
          <Link href="/login" className="text-blue-600 hover:underline">
            {LABEL_BACK_TO_LOGIN}
          </Link>
        </p>
      </div>
    </div>
  );
}
