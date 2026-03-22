"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const ROOM_ID_LENGTH = 6;
const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomRoomId(): string {
  const bytes = new Uint8Array(ROOM_ID_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

export default function HomePage() {
  const router = useRouter();
  /** Value of the “join existing room” text field — updated by typing or Paste. */
  const [roomId, setRoomId] = useState("");

  /** Reads the system clipboard and drops the result into the input (needs permission / secure context). */
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRoomId(text);
    } catch {
      alert(
        "Could not read the clipboard. Allow clipboard access for this site, or paste with Ctrl+V in the field.",
      );
    }
  }, []);

  /** Trims the id, blocks empty submits, then navigates with the App Router. */
  const handleJoinRoom = useCallback(() => {
    const id = roomId.trim();
    if (!id) {
      alert("Please enter a room ID.");
      return;
    }
    router.push(`/room/${encodeURIComponent(id)}`);
  }, [roomId, router]);

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 560,
      }}
    >
      <p style={{ margin: "0 0 12px", color: "#444", fontSize: 14 }}>
        Join with a room id someone shared, or create a new room.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Paste Room ID"
          aria-label="Room ID"
          style={{
            flex: "1 1 160px",
            minWidth: 120,
            padding: "8px 10px",
            fontSize: 14,
          }}
        />
        <button type="button" onClick={() => void handlePasteFromClipboard()}>
          Paste
        </button>
        <button type="button" onClick={handleJoinRoom}>
          Join Room
        </button>
      </div>

      <button
        type="button"
        onClick={() => router.push(`/room/${randomRoomId()}`)}
      >
        Create Room
      </button>
    </div>
  );
}
