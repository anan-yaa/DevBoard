"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

const DEFAULT_VALUE = "// Start coding...";

export default function EditorPage() {
  const [content, setContent] = useState(DEFAULT_VALUE);

  const handleChange = useCallback((value: string | undefined) => {
    setContent(value ?? "");
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Editor
        height="100vh"
        defaultLanguage="javascript"
        value={content}
        onChange={handleChange}
      />
    </div>
  );
}
