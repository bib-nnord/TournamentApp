'use client';

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { register } from "@/store/authSlice";
import type { AppDispatch, RootState } from "@/store/store";
import { LABEL_CREATE_ACCOUNT, LABEL_CREATING_ACCOUNT, LABEL_SIGN_IN } from "@/constants/labels";
import FormField from "@/components/FormField";

export default function RegisterPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [validationError, setValidationError] = useState('');

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }
    setValidationError('');
    const result = await dispatch(register({
      username,
      email,
      password,
      display_name: displayName,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
    }));
    if (register.fulfilled.match(result)) {
      router.push('/login');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
        <p className="text-sm text-gray-500 mb-6">Sign up to get started</p>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <FormField id="username" label="Username" placeholder="johndoe" value={username} onChange={setUsername} />
          <FormField id="display-name" label="Display name" placeholder="John" value={displayName} onChange={setDisplayName} />

          <div className="flex gap-3">
            <FormField id="first-name" label="First name" placeholder="John" value={firstName} onChange={setFirstName} className="flex-1" />
            <FormField id="last-name" label="Last name" placeholder="Doe" value={lastName} onChange={setLastName} className="flex-1" />
          </div>

          <FormField id="date-of-birth" label="Date of birth" type="date" value={dateOfBirth} onChange={setDateOfBirth} />
          <FormField id="email" label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
          <FormField id="password" label="Password" type="password" placeholder="••••••••" value={password} onChange={setPassword} />
          <FormField id="confirm-password" label="Confirm password" type="password" placeholder="••••••••" value={confirmPassword} onChange={setConfirmPassword} />

          {(validationError || error) && (
            <p className="text-sm text-red-600">{validationError || error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? LABEL_CREATING_ACCOUNT : LABEL_CREATE_ACCOUNT}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            {LABEL_SIGN_IN}
          </Link>
        </p>
      </div>
    </div>
  );
}
