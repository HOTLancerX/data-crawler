'use client';

import React, { useState } from 'react';
import { Icon } from '@iconify/react';

interface JsonViewerProps {
  data: any;
  filename?: string;
}

export default function JsonViewer({ data, filename = 'scraped-data.json' }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Syntax highlighting logic
  const renderHighlightedJson = () => {
    if (!jsonString) return null;

    const tokenRegex =
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    const text = jsonString;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const val = match[0];
      let cls = 'text-purple-600 dark:text-purple-400';

      if (/^"/.test(val)) {
        if (/:$/.test(val)) {
          cls = 'text-blue-600 dark:text-sky-400 font-semibold';
        } else {
          cls = 'text-emerald-600 dark:text-emerald-400';
        }
      } else if (/true|false/.test(val)) {
        cls = 'text-amber-600 dark:text-amber-400 font-semibold';
      } else if (/null/.test(val)) {
        cls = 'text-red-500 italic';
      }

      parts.push(
        <span key={match.index} className={cls}>
          {val}
        </span>
      );

      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden font-mono text-xs shadow-sm">
      {/* Top action toolbar */}
      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 font-sans">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">JSON Output</span>
          <span className="text-[11px] bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full font-mono">
            {Array.isArray(data) ? `${data.length} items` : '1 object'}
          </span>
          <span className="text-[11px] text-gray-400 font-mono">
            {(new Blob([jsonString]).size / 1024).toFixed(1)} KB
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Icon icon="solar:check-read-bold" className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Icon icon="solar:copy-bold" className="w-3.5 h-3.5 text-gray-500" />
                <span>Copy JSON</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-colors cursor-pointer"
          >
            <Icon icon="solar:download-minimalistic-bold" className="w-3.5 h-3.5" />
            <span>Download .json</span>
          </button>
        </div>
      </div>

      {/* Code viewer */}
      <div className="p-4 max-h-150 overflow-auto leading-relaxed select-text bg-gray-50/50 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
        <pre className="whitespace-pre">{renderHighlightedJson()}</pre>
      </div>
    </div>
  );
}
