import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-neutral-500">
        Sign-in is not configured yet.
      </main>
    );
  }
  return (
    <main className="flex justify-center px-4 py-16">
      <SignIn signUpUrl="/signup" />
    </main>
  );
}
