"use client";

export default function ForgotPasswordForm() {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="reset-email" className="text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            placeholder="you@example.com"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          className="mt-2 w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Send reset link
        </button>
      </form>
    </div>
  );
}
