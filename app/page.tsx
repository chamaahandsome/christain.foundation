export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Christian Foundation
      </h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        A home for sound teaching — and for the people who teach it.
      </p>
      <p className="max-w-xl text-sm uppercase tracking-widest text-neutral-500">
        In essentials, <span className="font-bold">unity</span>. In
        non-essentials, liberty. In all things, charity.
      </p>
      <p className="text-xs text-neutral-400">— Rupertus Meldenius</p>
    </main>
  );
}
