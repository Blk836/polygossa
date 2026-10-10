import type { Metadata } from "next";
import { AnkiSettings } from "@/components/settings/anki/anki-settings";

export const metadata: Metadata = { title: "Anki" };

export default function AnkiPage() {
  return <AnkiSettings />;
}
