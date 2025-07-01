import Link from 'next/link';

export default function VerifyEmailSentPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Email Verification Required
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>
                  We've sent a verification link to your email address. Please check
                  your inbox and click the link to verify your account.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm text-gray-600">
            Didn't receive the email?{' '}
            <Link
              href="/auth/resend-verification"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Click here to resend
            </Link>
          </p>
        </div>

        <div className="mt-4">
          <Link
            href="/auth/login"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Return to login
          </Link>
        </div>
      </div>
    </div>
  );
} 