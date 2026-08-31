import { redirect } from "next/navigation";

// The IA document never defines a real screen at bare "/" — only /login,
// /register, and the role portals. This was still Session 1's original
// placeholder, unnoticed until a real visitor landed on the production
// domain root and saw it instead of a sign-in page. proxy.ts's own
// unauthenticated-redirect logic sends people to /login anyway; this just
// closes the same gap for the one route middleware doesn't touch.
export default function Home() {
  redirect("/login");
}
