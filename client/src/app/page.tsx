'use client';

import Image from 'next/image';
import Link from 'next/link';

const Home = () => {
  return (
    <main className="min-h-screen bg-white">
      <div className="absolute top-8 left-8">
        <Image
          src="/logo.svg"
          alt="Invenage Logo"
          width={150}
          height={40}
          priority
        />
      </div>

      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Welcome to Invenage
        </h1>
        <p className="text-xl text-gray-600 mb-12 text-center max-w-2xl">
          Your complete inventory management solution. Streamline your operations,
          track inventory in real-time, and make data-driven decisions.
        </p>
        <Link
          href="/auth/login"
          className="btn-primary"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
};

export default Home; 