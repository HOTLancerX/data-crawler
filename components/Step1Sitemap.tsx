'use client';

import React, { useState } from 'react';
import { Icon } from '@iconify/react';

interface Step1SitemapProps {
  sitemapUrl: string;
  setSitemapUrl: (url: string) => void;
  onSitemapLoaded: (urls: string[], sitemapUrl: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const SAMPLE_PRESETS = [
  {
    name: 'Avechi Product Sitemap 2',
    url: 'https://avechi.co.ke/product-sitemap2.xml',
    note: 'From prompt',
  },
  {
    name: 'Avechi Product Sitemap 1',
    url: 'https://avechi.co.ke/product-sitemap1.xml',
    note: 'Electronics',
  },
];

const DEFAULT_AVECHI_SAMPLE_URLS = [
  'https://avechi.co.ke/product/samsung-super-fast-wireless-charging-pad-15w/',
  'https://avechi.co.ke/product/apc-800va-ups/',
  'https://avechi.co.ke/product/samsung-tab-a7-lite-flip-cover/',
  'https://avechi.co.ke/product/lg-65-inch-65uq7500-4k-active-hdr-tv/',
  'https://avechi.co.ke/product/anker-powerdrive-2-24w-port-car-charger/',
];

export default function Step1Sitemap({
  sitemapUrl,
  setSitemapUrl,
  onSitemapLoaded,
  isLoading,
  setIsLoading,
}: Step1SitemapProps) {
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'url' | 'raw_urls' | 'xml'>('url');
  const [rawText, setRawText] = useState('');
  const [subSitemaps, setSubSitemaps] = useState<string[]>([]);

  const handleFetchSitemap = async (targetUrl?: string) => {
    const urlToFetch = targetUrl || sitemapUrl;
    if (!urlToFetch.trim()) {
      setError('Please enter a valid sitemap URL');
      return;
    }

    setError(null);
    setIsLoading(true);
    setSubSitemaps([]);

    try {
      const res = await fetch('/api/data-crawler/sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToFetch.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch and parse sitemap');
      }

      if (data.isIndex && data.subSitemaps && data.subSitemaps.length > 0) {
        setSubSitemaps(data.subSitemaps);
        if (data.urls.length === 0) {
          setError(
            `This is a Sitemap Index containing ${data.subSitemaps.length} sub-sitemaps. Select one below to proceed:`
          );
          setIsLoading(false);
          return;
        }
      }

      if (!data.urls || data.urls.length === 0) {
        throw new Error(
          'No page URLs found in this sitemap. The site might be blocking server requests or the format is non-standard.'
        );
      }

      onSitemapLoaded(data.urls, urlToFetch);
    } catch (err: any) {
      setError(err.message || 'Failed to parse sitemap');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectUrls = () => {
    setError(null);
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http://') || l.startsWith('https://'));

    if (lines.length === 0) {
      setError('Please enter at least one valid URL starting with http:// or https://');
      return;
    }

    const uniqueUrls = Array.from(new Set(lines));
    onSitemapLoaded(uniqueUrls, 'Manual URL List');
  };

  const handleXmlParse = async () => {
    if (!rawText.trim()) {
      setError('Please paste XML sitemap content');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/data-crawler/sitemap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customXml: rawText }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to parse XML sitemap');
      }

      if (data.urls.length === 0) {
        throw new Error('No URLs found inside the provided XML content');
      }

      onSitemapLoaded(data.urls, 'Pasted XML Sitemap');
    } catch (err: any) {
      setError(err.message || 'Failed to parse XML sitemap');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvechiSampleUrls = () => {
    setSitemapUrl('https://avechi.co.ke/product-sitemap2.xml');
    onSitemapLoaded(DEFAULT_AVECHI_SAMPLE_URLS, 'https://avechi.co.ke/product-sitemap2.xml (Demo Set)');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 md:p-8 shadow-sm relative overflow-hidden">
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-xs mb-1 uppercase tracking-wider">
                <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                Step 1 of 4
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Enter Website Sitemap URL
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Provide an XML sitemap address to extract all target pages and products.
              </p>
            </div>

            {/* Mode switcher tabs */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 text-xs self-start">
              <button
                type="button"
                onClick={() => setMode('url')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  mode === 'url'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Sitemap URL
              </button>
              <button
                type="button"
                onClick={() => setMode('raw_urls')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  mode === 'raw_urls'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Paste URLs
              </button>
              <button
                type="button"
                onClick={() => setMode('xml')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  mode === 'xml'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Raw XML
              </button>
            </div>
          </div>

          {/* Mode 1: Sitemap URL Input */}
          {mode === 'url' && (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleFetchSitemap();
                }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Icon icon="solar:link-broken" className="w-5 h-5 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    value={sitemapUrl}
                    onChange={(e) => {
                      setSitemapUrl(e.target.value);
                      setError(null);
                    }}
                    placeholder="https://avechi.co.ke/product-sitemap2.xml"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl pl-11 pr-4 py-3.5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono text-sm shadow-inner transition-all"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !sitemapUrl.trim()}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl font-semibold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
                >
                  {isLoading ? (
                    <>
                      <Icon icon="solar:spinner-bold" className="w-5 h-5 animate-spin" />
                      Parsing Sitemap...
                    </>
                  ) : (
                    <>
                      Fetch URLs
                      <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Sample presets */}
              <div className="pt-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                  <Icon icon="solar:stars-minimalistic-bold" className="w-4 h-4 text-amber-500" />
                  <span>Presets &amp; Demo Samples:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {SAMPLE_PRESETS.map((p) => (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() => {
                        setSitemapUrl(p.url);
                        handleFetchSitemap(p.url);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 transition-all font-mono"
                    >
                      <span>{p.name}</span>
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">
                        {p.note}
                      </span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={loadAvechiSampleUrls}
                    className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-all font-medium ml-auto"
                    title="Load the 5 sample product URLs directly from your request"
                  >
                    <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Load 5 Avechi Sample URLs
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Paste Direct URLs */}
          {mode === 'raw_urls' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1.5">
                  Paste Webpage URLs (one per line):
                </label>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`https://avechi.co.ke/product/samsung-super-fast-wireless-charging-pad-15w/\nhttps://avechi.co.ke/product/apc-800va-ups/\nhttps://avechi.co.ke/product/samsung-tab-a7-lite-flip-cover/\nhttps://avechi.co.ke/product/lg-65-inch-65uq7500-4k-active-hdr-tv/\nhttps://avechi.co.ke/product/anker-powerdrive-2-24w-port-car-charger/`}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3.5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs shadow-inner"
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRawText(DEFAULT_AVECHI_SAMPLE_URLS.join('\n'))}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Insert 5 Avechi Sample Product URLs
                </button>

                <button
                  type="button"
                  onClick={handleDirectUrls}
                  disabled={!rawText.trim()}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md transition-all text-sm disabled:opacity-50"
                >
                  Load {rawText.split('\n').filter((l) => l.trim().startsWith('http')).length || 0} URLs
                  <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Mode 3: Paste Raw XML */}
          {mode === 'xml' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <Icon icon="solar:document-text-bold" className="w-4 h-4 text-amber-500" />
                  Paste Raw XML Sitemap Content:
                </label>
                <textarea
                  rows={6}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://avechi.co.ke/product/samsung-super-fast-wireless-charging-pad-15w/</loc>\n  </url>\n</urlset>`}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-3.5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs shadow-inner"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleXmlParse}
                  disabled={isLoading || !rawText.trim()}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md transition-all text-sm disabled:opacity-50"
                >
                  {isLoading ? (
                    <Icon icon="solar:spinner-bold" className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
                  )}
                  Parse XML Data
                </button>
              </div>
            </div>
          )}

          {/* Sub-sitemaps index picker if found */}
          {subSitemaps.length > 0 && (
            <div className="mt-5 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Icon icon="solar:refresh-bold" className="w-4 h-4" />
                Select a Sub-Sitemap to Fetch:
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {subSitemaps.map((sub, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSitemapUrl(sub);
                      handleFetchSitemap(sub);
                    }}
                    className="w-full text-left text-xs font-mono text-gray-700 dark:text-gray-300 hover:text-blue-600 p-2.5 rounded-lg bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-gray-200 dark:border-gray-700 transition-all flex items-center justify-between group"
                  >
                    <span className="truncate">{sub}</span>
                    <Icon icon="solar:arrow-right-bold" className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-5 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-start gap-3">
              <Icon icon="solar:danger-triangle-bold" className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="font-medium">{error}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={loadAvechiSampleUrls}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md font-semibold transition-all inline-flex items-center gap-1"
                  >
                    <Icon icon="solar:stars-minimalistic-bold" className="w-3.5 h-3.5" />
                    Load 5 Avechi Sample URLs
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('raw_urls')}
                    className="bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-700 dark:text-gray-200 px-3 py-1 rounded-md transition-all"
                  >
                    Paste URLs Manually
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
