"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";

import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const SOCKET_URL = "http://localhost:5000";
const DEFAULT_VALUE = "// Start coding...";
const EMIT_DEBOUNCE_MS = 150;

type CursorPos = { lineNumber: number; column: number };
type ReviewComment = {
  id: string;
  lineNumber: number;
  text: string;
  userId: string;
  username: string;
};

function roomIdFromParams(params: ReturnType<typeof useParams>): string | null {
  const raw = params.roomId;
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return null;
}

function generateUsername(): string {
  const adjectives = ["Quick", "Bright", "Clever", "Swift", "Smart", "Kind", "Bold", "Cool"];
  const animals = ["Fox", "Bear", "Eagle", "Wolf", "Lion", "Tiger", "Hawk", "Owl"];
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
  const randomNum = Math.floor(Math.random() * 1000);
  return `${randomAdj}${randomAnimal}${randomNum}`;
}

export default function RoomEditorPage() {
  const params = useParams();
  const roomId = roomIdFromParams(params);

  const [content, setContent] = useState(DEFAULT_VALUE);
  const [roomUsers, setRoomUsers] = useState<{id: string, username: string}[]>([]);
  const [presenceLog, setPresenceLog] = useState<string[]>([]);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, CursorPos>>(
    {},
  );
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  // CHALLENGE 11: Username generation was inconsistent on every render
// SOLUTION: Used useRef to generate username ONCE per user session
const username = useRef(`User-${Math.floor(Math.random() * 1000)}`);

  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipEmitForValueRef = useRef<string | null>(null);
  const prevRoomUsersRef = useRef<{id: string, username: string}[]>([]);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const commentDecorationIdsRef = useRef<string[]>([]);
  const cursorListenerDisposableRef = useRef<{ dispose: () => void } | null>(
    null,
  );
  const commentClickDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const cursorRafRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<CursorPos | null>(null);
  const applyIncomingCodeRef = useRef<(code: string) => void>(() => {});

  const applyIncomingCode = useCallback((code: string) => {
    skipEmitForValueRef.current = code;
    setContent(code);
    const ed = editorRef.current;
    if (ed && ed.getValue() !== code) {
      ed.setValue(code);
    }
  }, []);

  useLayoutEffect(() => {
    applyIncomingCodeRef.current = applyIncomingCode;
  }, [applyIncomingCode]);

  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;

    const model = ed.getModel();
    if (!model) return;

    const lineCount = model.getLineCount();
    const nextDecorations: editor.IModelDeltaDecoration[] = [];
    for (const [userId, pos] of Object.entries(remoteCursors)) {
      if (mySocketId && userId === mySocketId) continue;
      const line = Math.min(Math.max(1, pos.lineNumber), lineCount);
      const maxCol = model.getLineMaxColumn(line);
      const col = Math.min(Math.max(1, pos.column), Math.max(1, maxCol - 1));
      nextDecorations.push({
        range: new monaco.Range(line, col, line, col + 1),
        options: {
          className: "remote-cursor",
        },
      });
    }

    decorationIdsRef.current = ed.deltaDecorations(
      decorationIdsRef.current,
      nextDecorations,
    );
  }, [remoteCursors, mySocketId]);

  // CHALLENGE 12: Monaco hover was not working for inline comments
  // SOLUTION: Fixed decoration range and enabled hover in editor options
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    
    console.log("Comments state:", comments.length, "comments");
    console.log("Updating hover decorations for", comments.length, "comments");

    const monaco = monacoRef.current;
    
    // CHALLENGE 13: Multiple comments on same line were creating duplicate decorations
    // SOLUTION: Group comments by line number and create one decoration per line
    const groupedComments = new Map<number, ReviewComment[]>();
    comments.forEach(comment => {
      const line = comment.lineNumber;
      if (!groupedComments.has(line)) {
        groupedComments.set(line, []);
      }
      groupedComments.get(line)!.push(comment);
    });

    // CHALLENGE 14: Hover messages had poor formatting and no spacing
    // SOLUTION: Used markdown formatting with separators between comments
    const decorations = Array.from(groupedComments.entries()).map(([lineNumber, lineComments]) => ({
      // CHALLENGE 15: Decoration range was too narrow, hover wasn't triggering
      // SOLUTION: Extended range to full line width (column 1000) for better hover detection
      range: new monaco.Range(
        lineNumber,
        1,
        lineNumber,
        1000
      ),
      options: {
        isWholeLine: true,
        className: "commented-line",
        glyphMarginClassName: "comment-glyph",
        hoverMessage: {
          value: lineComments
            .map(c => `**💬 ${c.text}**\n_${c.username}_`)
            .join("\n\n---\n\n")
        }
      }
    }));

    console.log("Applied", decorations.length, "hover decorations for", groupedComments.size, "lines");
    commentDecorationIdsRef.current = editorRef.current.deltaDecorations(
      commentDecorationIdsRef.current,
      decorations
    );
  }, [comments]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    setContent(DEFAULT_VALUE);
    setRoomUsers([]);
    setPresenceLog([]);
    setMySocketId(null);
    setRemoteCursors({});
    setComments([]);
    prevRoomUsersRef.current = [];
    decorationIdsRef.current = [];
    commentDecorationIdsRef.current = [];

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    const onLoadCode = (code: unknown) => {
      if (typeof code !== "string") return;
      applyIncomingCodeRef.current(code);
    };

    const onCodeChange = (data: { code?: unknown }) => {
      if (typeof data?.code !== "string") return;
      applyIncomingCodeRef.current(data.code);
    };

    const onLoadComments = (payload: unknown) => {
      if (!Array.isArray(payload)) return;
      const parsed = payload.filter((item): item is ReviewComment => {
        if (!item || typeof item !== "object") return false;
        const rec = item as Record<string, unknown>;
        return (
          typeof rec.id === "string" &&
          typeof rec.userId === "string" &&
          typeof rec.text === "string" &&
          typeof rec.lineNumber === "number"
        );
      });
      setComments(parsed);
    };

    const onRoomUsers = (data: { users?: unknown }) => {
      const raw = data?.users;
      if (
        !Array.isArray(raw) ||
        !raw.every((user): user is {id: string, username: string} => 
          typeof user === "object" && 
          typeof user.id === "string" && 
          typeof user.username === "string"
        )
      ) {
        return;
      }
      const next = raw;
      const prev = prevRoomUsersRef.current;
      prevRoomUsersRef.current = next;
      setRoomUsers(next);

      setRemoteCursors((prevCursors) => {
        const userIds = next.map(u => u.id);
        const filtered = Object.fromEntries(
          Object.entries(prevCursors).filter(([uid]) => userIds.includes(uid)),
        ) as Record<string, CursorPos>;
        return filtered;
      });

      if (prev.length === 0) return;

      const prevIds = new Set(prev.map(u => u.id));
      const nextIds = new Set(next.map(u => u.id));
      const joined = next.filter((u) => !prevIds.has(u.id));
      const left = prev.filter((u) => !nextIds.has(u.id));
      const lines = [
        ...joined.map((u) => `User joined · ${u.username}`),
        ...left.map((u) => `User left · ${u.username}`),
      ];
      if (lines.length) {
        setPresenceLog((log) => [...log, ...lines].slice(-40));
      }
    };

    const onCursorUpdate = (data: {
      userId?: unknown;
      position?: unknown;
    }) => {
      if (typeof data.userId !== "string") return;
      const userId = data.userId;
      const pos = data.position;
      if (!pos || typeof pos !== "object") return;
      const { lineNumber, column } = pos as Record<string, unknown>;
      if (typeof lineNumber !== "number" || typeof column !== "number") {
        return;
      }
      setRemoteCursors((prev) => ({
        ...prev,
        [userId]: { lineNumber, column },
      }));
    };

    // CHALLENGE 16: Comments were appearing multiple times (duplicates)
  // SOLUTION: Removed direct local state updates, only update via socket events
  const onNewComment = (comment: unknown) => {
    console.log("🔥 RECEIVED new-comment event:", comment);
    if (!comment || typeof comment !== "object") return;
    const rec = comment as Record<string, unknown>;
    if (
      typeof rec.id !== "string" ||
      typeof rec.userId !== "string" ||
      typeof rec.text !== "string" ||
      typeof rec.lineNumber !== "number" ||
      typeof rec.username !== "string"
    ) {
      console.log("❌ Invalid comment format:", rec);
      return;
    }
    const parsed: ReviewComment = {
      id: rec.id,
      userId: rec.userId,
      text: rec.text,
      lineNumber: rec.lineNumber,
      username: rec.username,
    };
    
    console.log("📝 Processing comment:", parsed);
    setComments((prev) => {
      console.log("Current comments:", prev.length);
      console.log("Checking for duplicate ID:", parsed.id);
      
      // CHALLENGE 17: Duplicate prevention was failing due to weak ID checking
      // SOLUTION: Strict ID-based duplicate prevention with detailed logging
      if (prev.some((c) => c.id === parsed.id)) {
        console.log("🚫 Duplicate comment prevented:", parsed.id);
        return prev;
      }
      
      console.log("✅ Adding new comment:", parsed);
      const newComments = [...prev, parsed];
      console.log("📊 Total comments after adding:", newComments.length);
      return newComments;
    });
  };

    socket.on("load-code", onLoadCode);
    socket.on("load-comments", onLoadComments);
    socket.on("code-change", onCodeChange);
    socket.on("room-users", onRoomUsers);
    socket.on("cursor-update", onCursorUpdate);
    socket.on("new-comment", onNewComment);
    
    console.log("🔌 Socket listeners set up. Connected:", socket.connected);
    console.log("🏠 Listening for new-comment events...");

    // CHALLENGE 18: Join-room payload needed to include username for unified identity
    // SOLUTION: Updated emit to include username from useRef
    const onConnect = () => {
      setMySocketId(socket.id ?? null);
      socket.emit("join-room", { roomId, username: username.current });
    };
    if (socket.connected) onConnect();
    else socket.on("connect", onConnect);

    return () => {
      if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
      if (cursorRafRef.current !== null) {
        cancelAnimationFrame(cursorRafRef.current);
        cursorRafRef.current = null;
      }
      socket.off("load-code", onLoadCode);
      socket.off("load-comments", onLoadComments);
      socket.off("code-change", onCodeChange);
      socket.off("room-users", onRoomUsers);
      socket.off("cursor-update", onCursorUpdate);
      socket.off("new-comment", onNewComment);
      socket.off("connect", onConnect);
      socket.close();
      socketRef.current = null;
      decorationIdsRef.current = editorRef.current?.deltaDecorations(
        decorationIdsRef.current,
        [],
      ) ?? [];
      commentDecorationIdsRef.current = editorRef.current?.deltaDecorations(
        commentDecorationIdsRef.current,
        [],
      ) ?? [];
    };
  }, [roomId]);

  useEffect(() => {
    return () => {
      cursorListenerDisposableRef.current?.dispose();
      commentClickDisposableRef.current?.dispose();
      cursorListenerDisposableRef.current = null;
      commentClickDisposableRef.current = null;
    };
  }, []);

  const copyRoomId = useCallback(async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      /* ignore */
    }
  }, [roomId]);

  const handleChange = useCallback((value: string | undefined) => {
    const next = value ?? "";
    setContent(next);

    if (
      skipEmitForValueRef.current !== null &&
      skipEmitForValueRef.current === next
    ) {
      skipEmitForValueRef.current = null;
      return;
    }

    if (emitTimerRef.current) clearTimeout(emitTimerRef.current);
    emitTimerRef.current = setTimeout(() => {
      emitTimerRef.current = null;
      const sock = socketRef.current;
      const id = roomIdRef.current;
      if (!sock?.connected || !id) return;
      sock.emit("code-change", { roomId: id, code: next });
    }, EMIT_DEBOUNCE_MS);
  }, []);

  const handleEditorMount = useCallback(
    (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = ed;
      monacoRef.current = monaco;
      decorationIdsRef.current = [];
      commentDecorationIdsRef.current = [];

      // Ensure hover is enabled and glyph margin is set
      ed.updateOptions({
        hover: { enabled: true },
        glyphMargin: true
      });

      cursorListenerDisposableRef.current?.dispose();
      cursorListenerDisposableRef.current = ed.onDidChangeCursorPosition(
        () => {
          const p = ed.getPosition();
          if (!p) return;
          pendingCursorRef.current = {
            lineNumber: p.lineNumber,
            column: p.column,
          };
          if (cursorRafRef.current !== null) return;
          cursorRafRef.current = requestAnimationFrame(() => {
            cursorRafRef.current = null;
            const pos = pendingCursorRef.current;
            pendingCursorRef.current = null;
            if (!pos) return;
            const sock = socketRef.current;
            const rid = roomIdRef.current;
            if (!sock?.connected || !rid) return;
            sock.emit("cursor-move", { roomId: rid, position: pos });
          });
        },
      );

      commentClickDisposableRef.current?.dispose();
      commentClickDisposableRef.current = ed.onMouseDown((event) => {
        const clickedLine = event.target.position?.lineNumber;
        if (!clickedLine) return;
        
        // Check if this line has comments
        const lineComments = comments.filter(c => c.lineNumber === clickedLine);
        
        if (lineComments.length > 0) {
          setSelectedLine(clickedLine);
          console.log(`Line ${clickedLine} has ${lineComments.length} comment(s):`, lineComments);
          return;
        }
        
        // If no comments on this line, add a new comment
        const text = window.prompt(`Add comment on line ${clickedLine}`);
        const trimmed = text?.trim();
        if (!trimmed) return;

        // Check for duplicate comment (same text, same line, same user)
        const isDuplicate = comments.some(c => 
          c.lineNumber === clickedLine && 
          c.text === trimmed && 
          c.userId === uid
        );
        
        if (isDuplicate) {
          alert("You already added this comment to this line!");
          return;
        }

        const sock = socketRef.current;
        const rid = roomIdRef.current;
        const uid = sock?.id;
        if (!sock?.connected || !rid || !uid) return;

        // CHALLENGE 19: Comment creation was causing duplicates due to local state updates
        // SOLUTION: Removed setComments call, rely only on socket event for state updates
        const local: ReviewComment = {
          id: `${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          lineNumber: clickedLine,
          text: trimmed,
          userId: uid,
          username: username.current, // CHALLENGE 20: Username consistency - use same username from useRef
        };
        console.log("Emitting add-comment:", {
          roomId: rid,
          lineNumber: clickedLine,
          text: trimmed,
          userId: uid,
          username: username.current,
        });
        // Remove direct setComments - only update via socket event
        sock.emit("add-comment", {
          roomId: rid,
          lineNumber: clickedLine,
          text: trimmed,
          userId: uid,
          username: username.current,
        });
      });
    },
    [comments],
  );

  if (!roomId) {
    return <div className="room-invalid">Invalid room URL.</div>;
  }

  return (
    <div className="room-page">
      <header className="room-header">
        <div className="room-header__left">
          <span className="room-header__label">Room</span>
          <span className="room-header__room-id">{roomId}</span>
        </div>
        <div className="room-header__right">
          <span className="room-header__count">
            <strong>{roomUsers.length}</strong>
            {roomUsers.length === 1 ? " user" : " users"} online
          </span>
          <button
            type="button"
            className="room-btn room-btn--primary"
            onClick={() => void copyRoomId()}
          >
            Copy room ID
          </button>
        </div>
      </header>

      <div className="room-main">
        <div className="room-editor-wrap">
          <Editor
            key={roomId}
            height="100%"
            theme="vs-dark"
            defaultLanguage="javascript"
            value={content}
            onChange={handleChange}
            onMount={handleEditorMount}
            options={{ 
              glyphMargin: true,
              hover: {
                enabled: true
              }
            }}
          />
        </div>

        <aside className="room-sidebar">
          <h2 className="room-sidebar__title">Users</h2>
          <ul className="room-user-list">
            {roomUsers.length === 0 ? (
              <li className="room-user-item room-user-item--placeholder">
                Waiting for room data…
              </li>
            ) : (
              roomUsers.map((user) => {
                const isSelf = mySocketId !== null && user.id === mySocketId;
                return (
                  <li
                    key={user.id}
                    className={`room-user-item${isSelf ? " room-user-item--self" : ""}`}
                  >
                    {isSelf ? (
                      <span className="room-user-item__you">You</span>
                    ) : null}
                    {user.username}
                  </li>
                );
              })
            )}
          </ul>

          <hr className="room-sidebar__divider" />
          <h3 className="room-activity__title">Activity</h3>
          <ul className="room-activity__list">
            {presenceLog.length === 0 ? (
              <li>Join events will appear here.</li>
            ) : (
              presenceLog.map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}
