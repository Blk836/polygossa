import { redirect } from "next/navigation";

/** Saved was its own sub-tab; it is now My library's Saved filter. */
export default function SavedPage() {
  redirect("/library?source=saved");
}
