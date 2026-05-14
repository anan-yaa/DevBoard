'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce, useThrottledCallback } from '../hooks/useDebounce';

// Types for Monaco Editor
type MonacoEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  theme?: string;
  options?: any;
  height?: string;
  width?: string;
};

// Dynamic import with code splitting and no SSR
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div 
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e1e1e',
          color: '#cccccc',
          fontSize: '14px'
        }}
      >
        Loading editor...
      </div>
    ),
  }
);

// Optimized Monaco Editor component
export function OptimizedMonacoEditor({
  value,
  onChange,
  language = 'typescript',
  theme = 'vs-dark',
  options = {},
  height = '100%',
  width = '100%',
}: MonacoEditorProps) {
  const editorRef = useRef<any>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  // Debounced value for performance
  const debouncedValue = useDebounce(localValue, 300);

  // Throttled change handler
  const throttledOnChange = useThrottledCallback((newValue: string) => {
    onChange(newValue);
  }, 100);

  // Handle editor mount
  const handleEditorDidMount = useCallback((editor: any) => {
    editorRef.current = editor;
    setIsEditorReady(true);

    // Performance optimizations
    editor.updateOptions({
      ...options,
      // Reduce CPU usage
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'none',
      occurrencesHighlight: 'off',
      codeLens: false,
      folding: false,
      lineNumbers: 'on',
      glyphMargin: false,
      // Performance settings
      smoothScrolling: false,
      cursorBlinking: 'solid',
      cursorSmoothCaretAnimation: 'off',
      renderValidationDecorations: 'on',
      renderWhitespace: 'none',
    });

    // Add keyboard shortcuts
    // Note: Monaco shortcuts would be added here if needed
    // Currently disabled for performance

  }, [options]);

  // Handle value changes
  const handleChange = useCallback((newValue: string | undefined) => {
    if (newValue !== undefined && newValue !== localValue) {
      setLocalValue(newValue);
      throttledOnChange(newValue);
    }
  }, [localValue, throttledOnChange]);

  // Sync external value changes
  useEffect(() => {
    if (value !== localValue && isEditorReady) {
      setLocalValue(value);
    }
  }, [value, localValue, isEditorReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []);

  // Default options
  const defaultOptions = {
    selectOnLineNumbers: true,
    automaticLayout: true,
    fontSize: 14,
    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
    wordWrap: 'on',
    wordWrapColumn: 120,
    wrappingIndent: 'indent',
    smoothScrolling: false,
    cursorBlinking: 'solid',
    cursorSmoothCaretAnimation: 'off',
    renderLineHighlight: 'gutter',
    renderWhitespace: 'selection',
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    ...options,
  };

  return (
    <div style={{ height, width, position: 'relative' }}>
      <MonacoEditor
        value={localValue}
        language={language}
        theme={theme}
        options={defaultOptions}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        height={height}
        width={width}
      />
      
      {/* Performance indicator */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {isEditorReady ? 'Ready' : 'Loading...'}
        </div>
      )}
    </div>
  );
}

// Lazy loaded version for better performance
export const LazyMonacoEditor = dynamic(
  () => import('./OptimizedMonacoEditor').then(mod => ({ default: mod.OptimizedMonacoEditor })),
  {
    ssr: false,
    loading: () => (
      <div 
        style={{
          height: '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e1e1e',
          color: '#cccccc',
          fontSize: '14px'
        }}
      >
        Loading collaborative editor...
      </div>
    ),
  }
);

export default OptimizedMonacoEditor;
