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
  /** Value of the "join existing room" text field — updated by typing or Paste. */
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
    <div className="landing-page">
      <div className="landing-card">
        {/* Header */}
        <div className="landing-header">
          <h1 className="landing-title">DevBoard</h1>
          <p className="landing-subtitle">Real-time collaborative code editor</p>
        </div>

        {/* Join Room Section */}
        <div className="landing-section">
          <div className="input-group">
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID"
              aria-label="Room ID"
              className="landing-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleJoinRoom();
              }}
            />
            <button 
              type="button" 
              onClick={() => void handlePasteFromClipboard()}
              className="landing-button landing-button--secondary"
            >
              📋 Paste
            </button>
          </div>
          <button 
            type="button" 
            onClick={handleJoinRoom}
            className="landing-button landing-button--primary landing-button--full-width"
          >
            Join Room
          </button>
        </div>

        {/* Divider */}
        <div className="landing-divider">
          <span>OR</span>
        </div>

        {/* Create Room Section */}
        <div className="landing-section">
          <button
            type="button"
            onClick={() => router.push(`/room/${randomRoomId()}`)}
            className="landing-button landing-button--primary landing-button--full-width"
          >
            ✨ Create New Room
          </button>
        </div>

        {/* Footer */}
        <div className="landing-footer">
          <p>Share a room link to collaborate instantly</p>
        </div>
      </div>
    </div>
  );
}
