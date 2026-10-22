import { redirect } from "next/navigation";

// This app is for NEMA staff only. The public send reports through the
// separate Kuuma Obutonde reporter app (the Wetland-watch repo).
// Signed-out visitors are sent on to /login by middleware.js.
export default function Home() {
  redirect("/dashboard");
}
