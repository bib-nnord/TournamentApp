import Link from "next/link";

// Replace `isLoggedIn` with your auth state once auth is set up
const isLoggedIn = false;

export default function Navbar() {
  return (
    <header className="w-full bg-white border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-gray-800">
          Tournament App
        </Link>
        <div className="flex items-center space-x-2">
          {isLoggedIn ? (
            <Link href="/profile" className="text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-100">
              Profile
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">
                Login
              </Link>
              <Link href="/register" className="text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-100">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
