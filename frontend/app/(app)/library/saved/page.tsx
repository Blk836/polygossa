import { redirect } from "next/navigation";

export default function SavedPage() {
  redirect("/library?source=saved");
}
