"use client";

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addNotification } from "@/store/notificationsSlice";
import type { AppDispatch, RootState } from "@/store/store";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const API_URL = "http://localhost:2000";

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.user.current);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return (
      <div
        className={
          "min-h-screen bg-gradient-to-br from-indigo-50/80 "
          + "via-white to-purple-50/60 flex items-center "
          + "justify-center px-4"
        }
      >
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Already logged in
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            You must log out before resetting your password.
          </p>
          <Link
            href="/dashboard"
            className={
              "inline-block w-full py-2 bg-blue-600 "
              + "text-white rounded-lg text-sm font-medium "
              + "hover:bg-blue-700"
            }
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      dispatch(addNotification({
        type: "error",
        message: "Passwords do not match",
        duration: 5000,
      }));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        dispatch(addNotification({
          type: "error",
          message: data.error ?? "Something went wrong",
          duration: 5000,
        }));
        return;
      }

      dispatch(addNotification({
        type: "success",
        message: "Password reset successfully. You can now log in.",
        duration: 5000,
      }));
      router.push("/login");
    } catch {
      dispatch(addNotification({
        type: "error",
        message: "Network error. Please try again.",
        duration: 5000,
      }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={
        "min-h-screen bg-gradient-to-br from-indigo-50/80 "
        + "via-white to-purple-50/60 flex items-center "
        + "justify-center px-4"
      }
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Set new password
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Enter your new password below.
        </p>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="new-password"
              className="text-sm font-medium text-gray-700"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={
                "border border-gray-300 rounded-lg px-3 py-2 "
                + "text-sm focus:outline-none focus:ring-2 "
                + "focus:ring-blue-500"
              }
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="confirm-password"
              className="text-sm font-medium text-gray-700"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={
                "border border-gray-300 rounded-lg px-3 py-2 "
                + "text-sm focus:outline-none focus:ring-2 "
                + "focus:ring-blue-500"
              }
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={
              "mt-2 w-full py-2 bg-blue-600 text-white "
              + "rounded-lg text-sm font-medium "
              + "hover:bg-blue-700 disabled:opacity-50"
            }
          >
            {loading ? "Resetting..." : "Reset password"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-6">
          <Link href="/login" className="text-blue-600 hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
