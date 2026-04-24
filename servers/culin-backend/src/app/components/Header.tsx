import Link from 'next/link';

export default function Header() {
  return (
    <header className="absolute top-0 left-0 w-full p-4 flex justify-between items-center">
      <h1 className="text-3xl font-bold">CulinAI</h1>
      <nav>
        <Link href="/login" legacyBehavior>
          <a className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105">
            Login
          </a>
        </Link>
      </nav>
    </header>
  );
} 