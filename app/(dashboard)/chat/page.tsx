import { redirect } from "next/navigation";
import { getSetting } from "@/lib/db/settings";
import ChatContent from "./ChatContent";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  const apiKey = (() => {
    try {
      return getSetting("anthropicApiKey");
    } catch {
      return null;
    }
  })();

  if (!apiKey) {
    redirect("/settings?missing=chat");
  }

  return (
    <>
      <h2>Chat</h2>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 18px" }}>
        Ask questions about your portfolio. All responses are based on your current data.
      </p>
      <ChatContent />
    </>
  );
}
