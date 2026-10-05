'use client';

import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { UrlItem } from '@/plugin/data-crawler/types/scraper';

interface Step2UrlListProps {
  urls: UrlItem[];
  setUrls: React.Dispatch<React.SetStateAction<UrlItem[]>>;
  onNext: () => void;
  onBack: () => void;
  sitemapSource: string;
}

export default function Step2UrlList({
  urls,
  setUrls,
  onNext,
  onBack,
  sitemapSource,
}: Step2UrlListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [newUrlInput, setNewUrlInput] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filtered list based on search term
  const filteredUrls = useMemo(() => {
    if (!searchTerm.trim()) return urls;
    const term = searchTerm.toLowerCase();
    return urls.filter((u) => u.url.toLowerCase().includes(term));
  }, [urls, searchTerm]);

  // Selected counts
  const selectedCount = useMemo(() => urls.filter((u) => u.selected).length, [urls]);
  const totalCount = urls.length;

  // Toggle single item
  const toggleUrl = (id: string) => {
    setUrls((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  // Bulk actions
  const selectAll = () => {
    if (searchTerm.trim()) {
      const filteredIds = new Set(filteredUrls.map((u) => u.id));
      setUrls((prev) =>
        prev.map((item) => (filteredIds.has(item.id) ? { ...item, selected: true } : item))
      );
    } else {
      setUrls((prev) => prev.map((item) => ({ ...item, selected: true })));
    }
  };

  const deselectAll = () => {
    if (searchTerm.trim()) {
      const filteredIds = new Set(filteredUrls.map((u) => u.id));
      setUrls((prev) =>
        prev.map((item) => (filteredIds.has(item.id) ? { ...item, selected: false } : item))
      );
    } else {
      setUrls((prev) => prev.map((item) => ({ ...item, selected: false })));
    }
  };

  const selectFirstN = (n: number) => {
    setUrls((prev) =>
      prev.map((item, idx) => ({
        ...item,
        selected: idx < n,
      }))
    );
  };

  const invertSelection = () => {
    setUrls((prev) => prev.map((item) => ({ ...item, selected: !item.selected })));
  };

  const removeUrl = (id: string) => {
    setUrls((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddNewUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrlInput.trim()) return;

    let target = newUrlInput.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }

    const newItem: UrlItem = {
      id: 'custom-' + Date.now() + Math.random().toString(36).substring(2, 6),
      url: target,
      selected: true,
      status: 'idle',
    };

    setUrls((prev) => [newItem, ...prev]);
    setNewUrlInput('');
    setIsAddingUrl(false);
  };

  // Paginated items
  const paginatedUrls = useMemo(() => {
    if (pageSize === -1) return filteredUrls;
    const start = (currentPage - 1) * pageSize;
    return filteredUrls.slice(start, start + pageSize);
  }, [filteredUrls, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredUrls.length / pageSize);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-xs mb-1 uppercase tracking-wider">
              <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              Step 2 of 4
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Select URLs to Scrape
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Loaded <span className="text-blue-600 dark:text-blue-400 font-semibold">{totalCount}</span> URLs from{' '}
              <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{sitemapSource}</span>.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl text-center">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Selected</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {selectedCount}{' '}
                <span className="text-xs text-gray-400 font-normal">/ {totalCount}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onNext}
              disabled={selectedCount === 0}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:cursor-not-allowed text-xs"
            >
              <span>Next: XPath Fields</span>
              <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Select actions, Add URL */}
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Icon icon="solar:magnifer-linear" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter URLs (e.g. samsung, ear-1, tv)..."
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl pl-10 pr-4 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Select Actions */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500 font-medium mr-1 flex items-center gap-1">
              <Icon icon="solar:filter-bold" className="w-3.5 h-3.5 text-gray-400" />
              Quick:
            </span>

            <button
              type="button"
              onClick={selectAll}
              className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
            >
              Select All
            </button>

            <button
              type="button"
              onClick={deselectAll}
              className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
            >
              Deselect All
            </button>

            <button
              type="button"
              onClick={() => selectFirstN(5)}
              className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors font-medium"
            >
              First 5
            </button>

            <button
              type="button"
              onClick={() => selectFirstN(10)}
              className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
            >
              First 10
            </button>

            <button
              type="button"
              onClick={invertSelection}
              className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
            >
              Invert
            </button>

            <button
              type="button"
              onClick={() => setIsAddingUrl(!isAddingUrl)}
              className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors inline-flex items-center gap-1 font-medium"
            >
              <Icon icon="solar:add-circle-bold" className="w-3.5 h-3.5" />
              Add URL
            </button>
          </div>
        </div>

        {/* Form to add custom URL */}
        {isAddingUrl && (
          <form onSubmit={handleAddNewUrl} className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 flex gap-2">
            <input
              type="text"
              value={newUrlInput}
              onChange={(e) => setNewUrlInput(e.target.value)}
              placeholder="https://avechi.co.ke/product/new-product-slug/"
              className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAddingUrl(false)}
              className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 text-xs px-3 py-2 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
          </form>
        )}
      </div>

      {/* URL List Container */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Table header */}
        <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 font-medium">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selectedCount === totalCount ? deselectAll : selectAll}
              className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 cursor-pointer font-medium"
            >
              <Icon
                icon={selectedCount === totalCount && totalCount > 0 ? "solar:check-square-bold" : "solar:square-linear"}
                className="w-4 h-4 text-blue-600"
              />
              <span>Select All Shown</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">
              Showing {paginatedUrls.length} of {filteredUrls.length} URLs
            </span>

            {/* Page size dropdown */}
            <div className="flex items-center gap-1.5">
              <span>View:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded px-2 py-1 focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>All</option>
              </select>
            </div>
          </div>
        </div>

        {/* URLs List Items */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-125 overflow-y-auto">
          {paginatedUrls.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              No URLs found matching your filter &quot;{searchTerm}&quot;.
            </div>
          ) : (
            paginatedUrls.map((item, idx) => {
              const displayIndex = (currentPage - 1) * (pageSize === -1 ? 0 : pageSize) + idx + 1;
              return (
                <div
                  key={item.id}
                  onClick={() => toggleUrl(item.id)}
                  className={`px-4 py-3 flex items-center gap-3.5 transition-colors cursor-pointer group ${
                    item.selected
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/40 opacity-75 hover:opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleUrl(item.id);
                    }}
                    className="shrink-0 text-gray-400 hover:text-blue-600"
                  >
                    <Icon
                      icon={item.selected ? "solar:check-square-bold" : "solar:square-linear"}
                      className={`w-4 h-4 ${item.selected ? "text-blue-600" : "text-gray-400"}`}
                    />
                  </button>

                  <span className="text-[11px] font-mono text-gray-400 w-8 shrink-0 text-right">
                    #{displayIndex}
                  </span>

                  <span
                    className={`font-mono text-xs truncate flex-1 ${
                      item.selected ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {item.url}
                  </span>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="Open URL in new tab"
                    >
                      <Icon icon="solar:arrow-right-up-linear" className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeUrl(item.id);
                      }}
                      className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="Remove from list"
                    >
                      <Icon icon="solar:trash-bin-trash-bold" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs">
            <span className="text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-xl font-medium transition-colors text-xs cursor-pointer"
        >
          <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
          <span>Change Sitemap (Step 1)</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={selectedCount === 0}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md shadow-blue-600/20 transition-all text-xs cursor-pointer disabled:cursor-not-allowed"
        >
          <span>Next: Configure XPath Fields ({selectedCount} Selected)</span>
          <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
