'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { DynamicField, UrlItem } from '@/plugin/data-crawler/types/scraper';
import JsonViewer from '@/plugin/data-crawler/components/JsonViewer';

interface Step4ScrapeResultsProps {
  selectedUrls: UrlItem[];
  fields: DynamicField[];
  onBackToStep3: () => void;
  onResetAll: () => void;
}

export default function Step4ScrapeResults({
  selectedUrls,
  fields,
  onBackToStep3,
  onResetAll,
}: Step4ScrapeResultsProps) {
  // Items state with scraping status
  const [items, setItems] = useState<UrlItem[]>(() =>
    selectedUrls.map((u) => ({
      ...u,
      status: 'idle',
      data: undefined,
      error: undefined,
      durationMs: undefined,
    }))
  );

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [concurrency, setConcurrency] = useState<number>(2);
  const [viewMode, setViewMode] = useState<'json' | 'table' | 'cards' | 'queue'>('json');
  const [selectedItemDetail, setSelectedItemDetail] = useState<UrlItem | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const stopSignalRef = useRef(false);
  const pauseSignalRef = useRef(false);

  // Synchronize stop / pause refs
  useEffect(() => {
    pauseSignalRef.current = isPaused;
  }, [isPaused]);

  // Clean JSON data array of successfully scraped items
  const extractedJsonArray = useMemo(() => {
    return items
      .filter((i) => i.status === 'success' && i.data)
      .map((i) => ({
        url: i.url,
        scraped_at: new Date().toISOString(),
        ...i.data,
      }));
  }, [items]);

  // Counters
  const completedCount = items.filter((i) => i.status === 'success' || i.status === 'error').length;
  const successCount = items.filter((i) => i.status === 'success').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Single URL scraper function
  const scrapeSingleUrl = async (item: UrlItem): Promise<void> => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: 'scraping', error: undefined } : i))
    );

    const startTime = Date.now();
    try {
      const res = await fetch('/api/data-crawler/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: item.url,
          fields,
        }),
      });

      const json = await res.json();
      const durationMs = json.durationMs || Date.now() - startTime;

      if (json.success && json.data) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'success',
                  data: json.data,
                  durationMs,
                  error: json.errors ? Object.values(json.errors).join(', ') : undefined,
                }
              : i
          )
        );
      } else {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'error',
                  error: json.error || 'Failed to extract data',
                  durationMs,
                }
              : i
          )
        );
      }
    } catch (err: any) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: 'error',
                error: err.message || 'Network request failed',
                durationMs: Date.now() - startTime,
              }
            : i
        )
      );
    }
  };

  // Main scraper runner loop with concurrency
  const startScraping = async (retryOnlyErrors = false) => {
    stopSignalRef.current = false;
    pauseSignalRef.current = false;
    setIsRunning(true);
    setIsPaused(false);

    const toProcess = items.filter((i) =>
      retryOnlyErrors ? i.status === 'error' : i.status === 'idle' || i.status === 'error'
    );

    if (toProcess.length === 0) {
      setItems((prev) =>
        prev.map((i) => ({ ...i, status: 'idle', data: undefined, error: undefined }))
      );
    }

    const queue = toProcess.length > 0 ? [...toProcess] : [...items];
    let currentIndex = 0;

    const runWorker = async () => {
      while (currentIndex < queue.length) {
        if (stopSignalRef.current) break;

        if (pauseSignalRef.current) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }

        const currentItem = queue[currentIndex++];
        if (!currentItem) break;

        await scrapeSingleUrl(currentItem);
      }
    };

    const workerPromises = [];
    const actualConcurrency = Math.min(concurrency, queue.length || 1);
    for (let c = 0; c < actualConcurrency; c++) {
      workerPromises.push(runWorker());
    }

    await Promise.all(workerPromises);
    setIsRunning(false);
    setIsPaused(false);
  };

  const stopScraping = () => {
    stopSignalRef.current = true;
    setIsRunning(false);
    setIsPaused(false);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  useEffect(() => {
    startScraping();
    return () => {
      stopSignalRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateCsv = () => {
    if (extractedJsonArray.length === 0) return '';
    const headers = ['url', ...fields.map((f) => f.name)];

    const rows = extractedJsonArray.map((row: any) => {
      return headers
        .map((header) => {
          const val = row[header];
          if (val === null || val === undefined) return '""';
          if (Array.isArray(val)) {
            return `"${val.join('; ').replace(/"/g, '""')}"`;
          }
          if (typeof val === 'object') {
            return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          }
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  };

  const downloadCsv = () => {
    const csvContent = generateCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'scraped-data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const displayItems = useMemo(() => {
    if (!searchFilter.trim()) return items;
    const q = searchFilter.toLowerCase();
    return items.filter((item) => {
      if (item.url.toLowerCase().includes(q)) return true;
      if (item.data) {
        return Object.values(item.data).some((val) =>
          String(val).toLowerCase().includes(q)
        );
      }
      return false;
    });
  }, [items, searchFilter]);

  return (
    <div className="space-y-6">
      {/* Header and Control Panel */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs mb-1 uppercase tracking-wider">
              <span
                className={`flex h-2 w-2 rounded-full ${
                  isRunning ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'
                }`}
              />
              Step 4 of 4: Scraping Engine
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Scraping Results &amp; JSON Data
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Extracting {fields.length} dynamic XPath fields across {totalCount} selected URLs.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {isRunning ? (
              <>
                <button
                  type="button"
                  onClick={togglePause}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  <Icon icon={isPaused ? "solar:play-bold" : "solar:pause-bold"} className="w-4 h-4" />
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  onClick={stopScraping}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer shadow-sm"
                >
                  <Icon icon="solar:stop-bold" className="w-4 h-4" />
                  Stop
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => startScraping(false)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer shadow-md shadow-blue-600/20"
                >
                  <Icon icon="solar:play-bold" className="w-4 h-4" />
                  {completedCount === totalCount ? 'Re-Run All' : 'Start Scraping'}
                </button>

                {errorCount > 0 && (
                  <button
                    type="button"
                    onClick={() => startScraping(true)}
                    className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Icon icon="solar:restart-bold" className="w-4 h-4" />
                    Retry {errorCount} Failed
                  </button>
                )}
              </>
            )}

            {/* Export button */}
            <button
              type="button"
              onClick={downloadCsv}
              disabled={extractedJsonArray.length === 0}
              className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 disabled:opacity-40 text-gray-700 dark:text-gray-200 px-3.5 py-2.5 rounded-xl font-medium text-xs border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
              title="Download results as CSV spreadsheet"
            >
              <Icon icon="solar:download-minimalistic-bold" className="w-4 h-4" />
              Download CSV
            </button>
          </div>
        </div>

        {/* Progress bar & Stats */}
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-gray-900 dark:text-white">
                {progressPercent}% Complete
              </span>
              <span className="text-gray-500">
                ({completedCount} of {totalCount} URLs processed)
              </span>
              {isRunning && (
                <span className="text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-1.5">
                  <Icon icon="solar:spinner-bold" className="w-3.5 h-3.5 animate-spin" />
                  Scraping in progress...
                </span>
              )}
            </div>

            {/* Quick Stat Badges */}
            <div className="flex items-center gap-3">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5" />
                {successCount} Success
              </span>
              {errorCount > 0 && (
                <span className="text-red-500 font-medium flex items-center gap-1">
                  <Icon icon="solar:close-circle-bold" className="w-3.5 h-3.5" />
                  {errorCount} Errors
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent === 100
                  ? 'bg-emerald-500'
                  : 'bg-linear-to-r from-blue-600 to-indigo-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Concurrency Selector */}
          <div className="flex items-center justify-between pt-1 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <span>Concurrency:</span>
              {[1, 2, 3, 5].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setConcurrency(c)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    concurrency === c
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  {c}x
                </button>
              ))}
            </div>

            <div className="text-[11px] text-gray-500">
              Extracted JSON records:{' '}
              <span className="text-gray-900 dark:text-white font-semibold font-mono">{extractedJsonArray.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation tabs & Views */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* View Mode switcher */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setViewMode('json')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'json'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Icon icon="solar:code-file-bold" className="w-3.5 h-3.5" />
            JSON View ({extractedJsonArray.length})
          </button>

          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Icon icon="solar:widget-bold" className="w-3.5 h-3.5" />
            Data Table
          </button>

          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'cards'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Icon icon="solar:gallery-wide-bold" className="w-3.5 h-3.5" />
            Product Cards
          </button>

          <button
            type="button"
            onClick={() => setViewMode('queue')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              viewMode === 'queue'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Icon icon="solar:checklist-minimalistic-bold" className="w-3.5 h-3.5" />
            Queue ({items.length})
          </button>
        </div>

        {/* Search inside results */}
        {(viewMode === 'table' || viewMode === 'cards') && (
          <div className="relative max-w-xs w-full">
            <Icon icon="solar:magnifer-linear" className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search extracted data..."
              className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* VIEW 1: JSON VIEWER */}
      {viewMode === 'json' && (
        <JsonViewer
          data={extractedJsonArray}
          filename="scraped-products.json"
        />
      )}

      {/* VIEW 2: DATA TABLE */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-150">
            <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300 font-sans border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800/80 sticky top-0 border-b border-gray-200 dark:border-gray-800 z-10">
                <tr>
                  <th className="p-3.5 font-semibold text-gray-500 w-12 text-center">#</th>
                  <th className="p-3.5 font-semibold text-gray-500 w-24">Status</th>
                  <th className="p-3.5 font-semibold text-gray-500 min-w-50">URL</th>
                  {fields.map((field) => (
                    <th key={field.id} className="p-3.5 font-semibold text-gray-800 dark:text-gray-200 min-w-40">
                      {field.name}
                      <span className="text-[10px] text-gray-400 font-mono block">
                        {field.type}
                      </span>
                    </th>
                  ))}
                  <th className="p-3.5 font-semibold text-gray-500 w-20 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {displayItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={fields.length + 4}
                      className="p-8 text-center text-gray-400"
                    >
                      No records match your filter.
                    </td>
                  </tr>
                ) : (
                  displayItems.map((item, index) => {
                    const d = item.data || {};
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group cursor-pointer"
                        onClick={() => setSelectedItemDetail(item)}
                      >
                        <td className="p-3.5 font-mono text-gray-400 text-center">
                          {index + 1}
                        </td>
                        <td className="p-3.5">
                          {item.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <Icon icon="solar:check-circle-bold" className="w-3 h-3 text-emerald-600" /> 200 OK
                            </span>
                          ) : item.status === 'error' ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800"
                              title={item.error}
                            >
                              <Icon icon="solar:close-circle-bold" className="w-3 h-3 text-red-500" /> Error
                            </span>
                          ) : item.status === 'scraping' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 animate-pulse">
                              <Icon icon="solar:spinner-bold" className="w-3 h-3 animate-spin text-blue-600" /> Extracting
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-400">Queued</span>
                          )}
                        </td>

                        <td className="p-3.5 font-mono text-[11px] text-gray-500 truncate max-w-xs">
                          {item.url}
                        </td>

                        {fields.map((field) => {
                          const val = d[field.name];

                          return (
                            <td key={field.id} className="p-3.5 max-w-xs truncate">
                              {typeof val === 'string' && val.trim().startsWith('<img') ? (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-8 h-8 rounded border border-gray-200 bg-white overflow-hidden shrink-0 flex items-center justify-center [&_img]:w-full [&_img]:h-full [&_img]:object-cover"
                                    dangerouslySetInnerHTML={{ __html: val }}
                                  />
                                  <div className="min-w-0">
                                    <span
                                      className="font-mono text-[10px] text-emerald-600 block truncate max-w-37.5"
                                      title={val}
                                    >
                                      {val}
                                    </span>
                                  </div>
                                </div>
                              ) : (field.type === 'image_list' || field.type === 'gallery_remaining') && Array.isArray(val) ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex items-center gap-1">
                                    {val.slice(0, 3).map((img, i) => (
                                      <div
                                        key={i}
                                        className="w-8 h-8 rounded border border-gray-200 bg-white overflow-hidden shrink-0"
                                      >
                                        <img
                                          src={img}
                                          alt="img"
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="text-[10px] text-gray-500 font-mono">
                                    {val.length > 3 ? `+${val.length - 3}` : `(${val.length})`}
                                  </div>
                                </div>
                              ) : field.type === 'image_url' && typeof val === 'string' ? (
                                <div className="w-8 h-8 rounded border border-gray-200 bg-white overflow-hidden">
                                  <img
                                    src={val}
                                    alt="img"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : Array.isArray(val) ? (
                                <span className="font-mono text-gray-500">
                                  [{val.length} items]
                                </span>
                              ) : val === null || val === undefined ? (
                                <span className="text-gray-400 italic">null</span>
                              ) : (
                                <span className="text-gray-800 dark:text-gray-200">{String(val)}</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItemDetail(item);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-100"
                            title="Inspect complete JSON"
                          >
                            <Icon icon="solar:eye-bold" className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: PRODUCT / CONTENT CARDS */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayItems.map((item, idx) => {
            const d = item.data || {};
            const tagField = fields.find(
              (f) => f.type === 'first_image_tag' || f.name.includes('main_image') || f.name.includes('first_img')
            );
            const tagVal = tagField ? d[tagField.name] : null;

            let heroImgSrc: string | null = null;
            if (typeof tagVal === 'string') {
              const srcMatch = tagVal.match(/src=["']([^"']+)["']/i);
              if (srcMatch) heroImgSrc = srcMatch[1];
            }

            const galleryField = fields.find(
              (f) => f.type === 'image_list' || f.type === 'gallery_remaining' || f.name.includes('gallery')
            );
            const galleryImages: string[] =
              galleryField && Array.isArray(d[galleryField.name]) ? d[galleryField.name] : [];

            if (!heroImgSrc) {
              const imgField = fields.find(
                (f) => f.name === 'image' || f.type === 'first_image_url' || f.type === 'image_url'
              );
              if (imgField && typeof d[imgField.name] === 'string') {
                heroImgSrc = d[imgField.name];
              } else if (galleryImages.length > 0) {
                heroImgSrc = galleryImages[0];
              }
            }

            const title =
              d.title || d.headline || d.name || item.url.split('/').filter(Boolean).pop() || 'Untitled';
            const price = d.price || d.amount || null;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedItemDetail(item)}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-blue-400 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group cursor-pointer flex flex-col"
              >
                {/* Image showcase */}
                <div className="h-48 bg-gray-50 dark:bg-gray-950 relative overflow-hidden flex items-center justify-center border-b border-gray-100 dark:border-gray-800">
                  {heroImgSrc ? (
                    <img
                      src={heroImgSrc}
                      alt={title}
                      className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-gray-400 text-xs font-mono">No Image Extracted</div>
                  )}

                  {galleryImages.length > 0 && (
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono">
                      Gallery: {galleryImages.length} images
                    </span>
                  )}

                  <span className="absolute top-2 left-2 bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 text-[10px] px-2 py-0.5 rounded-md font-mono border border-gray-200 dark:border-gray-700">
                    #{idx + 1}
                  </span>
                </div>

                {/* Thumbnails row */}
                {galleryImages.length > 0 && (
                  <div className="p-2 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 space-y-1">
                    <div className="flex gap-1.5 overflow-x-auto">
                      {galleryImages.slice(0, 6).map((img, i) => (
                        <div
                          key={i}
                          className="w-9 h-9 rounded border border-gray-200 dark:border-gray-700 bg-white shrink-0 overflow-hidden"
                        >
                          <img src={img} alt="thumb" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                      {title}
                    </h3>

                    {price && (
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mt-1">
                        {String(price)}
                      </div>
                    )}
                  </div>

                  {/* URL */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
                    <span className="font-mono text-[10px] truncate max-w-50">
                      {item.url}
                    </span>
                    <Icon icon="solar:arrow-right-up-linear" className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 4: QUEUE & STATUS DETAILS */}
      {viewMode === 'queue' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
          <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 flex items-center justify-between text-xs text-gray-500 font-semibold">
            <span>Execution Queue ({items.length} Target URLs)</span>
            <span>Duration &amp; Status</span>
          </div>

          <div className="max-h-125 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => setSelectedItemDetail(item)}
                className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-gray-400 font-mono text-xs w-6 shrink-0">
                    #{idx + 1}
                  </span>

                  {item.status === 'success' && (
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  {item.status === 'error' && (
                    <Icon icon="solar:close-circle-bold" className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  {item.status === 'scraping' && (
                    <Icon icon="solar:spinner-bold" className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                  )}
                  {item.status === 'idle' && (
                    <Icon icon="solar:clock-circle-linear" className="w-4 h-4 text-gray-400 shrink-0" />
                  )}

                  <div className="min-w-0">
                    <div className="font-mono text-xs text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600">
                      {item.url}
                    </div>
                    {item.error && (
                      <div className="text-[11px] text-red-500 truncate mt-0.5">
                        {item.error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {item.durationMs && (
                    <span className="text-gray-400 font-mono text-[11px]">
                      {item.durationMs}ms
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrapeSingleUrl(item);
                    }}
                    className="text-xs text-gray-600 hover:text-blue-600 px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Re-test
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item Detail Inspector Modal */}
      {selectedItemDetail && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedItemDetail(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Item Scraped JSON Data</h3>
                <p className="text-xs text-gray-500 font-mono truncate max-w-md mt-0.5">
                  {selectedItemDetail.url}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 text-sm font-semibold"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              <JsonViewer
                data={{
                  url: selectedItemDetail.url,
                  status: selectedItemDetail.status,
                  durationMs: selectedItemDetail.durationMs,
                  extracted: selectedItemDetail.data || null,
                  error: selectedItemDetail.error || null,
                }}
                filename="item-data.json"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={onBackToStep3}
          className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-xl font-medium transition-colors text-xs cursor-pointer"
        >
          <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
          <span>Modify XPath Fields (Step 3)</span>
        </button>

        <button
          type="button"
          onClick={onResetAll}
          className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 px-4 py-2.5 rounded-xl text-xs transition-colors border border-gray-200 cursor-pointer"
        >
          <Icon icon="solar:restart-bold" className="w-3.5 h-3.5" />
          <span>Start New Sitemap</span>
        </button>
      </div>
    </div>
  );
}
