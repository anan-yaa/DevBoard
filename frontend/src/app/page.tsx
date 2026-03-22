"use client";

import { useRouter } from "next/navigation";

const ROOM_ID_LENGTH = 6;
const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomRoomId(): string {
  const bytes = new Uint8Array(ROOM_ID_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

export default function HomePage() {
  const router = useRouter();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <button
        type="button"
        onClick={() => router.push(`/room/${randomRoomId()}`)}
      >
        Create Room
      </button>
    </div>
  );
}
