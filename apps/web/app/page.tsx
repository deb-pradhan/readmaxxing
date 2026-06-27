import { redirect } from "next/navigation";

/**
 * Root index — for signed-in users this redirects to /library. The
 * marketing home page lives at `/marketing` (rendered on demand); we
 * keep `/` thin so the library stays the calm landing surface for
 * every signed-in reader.
 */
export default function HomePage(): never {
  redirect("/library");
}