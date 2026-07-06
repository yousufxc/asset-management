import { getSetting } from "@/lib/db/settings";
import ChatContent from "./ChatContent";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  const hasApiKey = (() => {
    try {
      return !!getSetting("anthropicApiKey");
    } catch {
      return false;
    }
  })();

  return (
    <>
      <h2>Chat</h2>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 18px" }}>
        Ask questions about your portfolio. All responses are based on your current data.
      </p>
      <ChatContent hasApiKey={hasApiKey} />
    </>
  );
}
