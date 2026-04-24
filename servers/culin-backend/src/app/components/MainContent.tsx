import Link from 'next/link';

export default function MainContent() {
  return (
    <main className="text-center space-y-6">
      <h2 className="text-7xl font-extrabold tracking-tight animate-fade-in-down">
        Welcome to <span className="text-green-400">CulinAI</span>
      </h2>
      <p className="text-2xl text-slate-300 max-w-3xl mx-auto animate-fade-in-up delay-500" style={{ marginBottom: '50px' }}>
        Your personal culinary assistant.
      </p>
      <div className="animate-fade-in-up delay-1000">
        <Link href="/chat" legacyBehavior>
          <a className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-10 rounded-full text-xl shadow-lg hover:shadow-xl transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300">
            Get Started
          </a>
        </Link>
      </div>
    </main>
  );
} 