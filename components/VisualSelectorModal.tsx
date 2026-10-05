'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { DynamicField } from '@/plugin/data-crawler/types/scraper';

interface VisualSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sampleUrl: string;
  onApplyFields: (newFields: DynamicField[]) => void;
  currentFields: DynamicField[];
}

export default function VisualSelectorModal({
  isOpen,
  onClose,
  sampleUrl,
  onApplyFields,
  currentFields,
}: VisualSelectorModalProps) {
  const [targetUrl, setTargetUrl] = useState(sampleUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [copiedTag, setCopiedTag] = useState(false);
  const [appliedNotification, setAppliedNotification] = useState<string | null>(null);

  const counterRef = useRef(1);

  const handleInspect = async (urlToInspect?: string) => {
    const url = urlToInspect || targetUrl;
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch('/api/data-crawler/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to inspect page elements');
      }

      setData(json);
    } catch (err: any) {
      setError(err.message || 'Inspection failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (isOpen && !data && targetUrl) {
      queueMicrotask(() => {
        if (active) setLoading(true);
      });
      fetch('/api/data-crawler/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (!active) return;
          setLoading(false);
          if (json.success) {
            setData(json);
          } else {
            setError(json.error || 'Failed to inspect page elements');
          }
        })
        .catch((err) => {
          if (!active) return;
          setLoading(false);
          setError(err.message || 'Inspection failed');
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen, data, targetUrl]);

  if (!isOpen) return null;

  const applyGallerySplit = (gallery: any) => {
    const xpath = gallery.genericXpath || gallery.xpath;
    const c1 = counterRef.current++;
    const c2 = counterRef.current++;

    const mainTagField: DynamicField = {
      id: `field_img_tag_${c1}`,
      name: 'featured_img_tag',
      xpath,
      type: 'first_image_tag',
      imgTagClass: 'featured-image',
    };

    const remainingGalleryField: DynamicField = {
      id: `field_gallery_rem_${c2}`,
      name: 'gallery',
      xpath,
      type: 'gallery_remaining',
      excludeFirstImage: true,
    };

    const updated = currentFields.filter(
      (f) => f.name !== 'featured_img_tag' && f.name !== 'gallery' && f.name !== 'main_img_tag'
    );

    onApplyFields([mainTagField, remainingGalleryField, ...updated]);
    setAppliedNotification(
      'Configured: 1) "featured_img_tag" (<img> tag of 1st image) + 2) "gallery" (remaining images without the 1st image)'
    );
    setTimeout(() => setAppliedNotification(null), 4000);
  };

  const addSingleField = (name: string, xpath: string, type: any, extra?: Partial<DynamicField>) => {
    const c = counterRef.current++;
    const newField: DynamicField = {
      id: `field_vis_${c}`,
      name,
      xpath,
      type,
      ...extra,
    };

    let finalName = name;
    let counter = 1;
    while (currentFields.some((f) => f.name === finalName)) {
      finalName = `${name}_${counter++}`;
    }
    newField.name = finalName;

    onApplyFields([...currentFields, newField]);
    setAppliedNotification(`Added field: "${finalName}" (${type})`);
    setTimeout(() => setAppliedNotification(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTag(true);
    setTimeout(() => setCopiedTag(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
              <Icon icon="solar:stars-minimalistic-bold" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Visual Element Selector &amp; Gallery Splitter
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Inspect a URL visually to extract the first image tag and remaining gallery.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* URL Target Bar */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleInspect();
            }}
            className="flex gap-2"
          >
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://avechi.co.ke/product/samsung-super-fast-wireless-charging-pad-15w/"
              className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl px-3.5 py-2 text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={loading || !targetUrl.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors inline-flex items-center gap-2 shrink-0 cursor-pointer"
            >
              {loading ? (
                <>
                  <Icon icon="solar:spinner-bold" className="w-4 h-4 animate-spin" />
                  Inspecting...
                </>
              ) : (
                <>
                  <Icon icon="solar:widget-bold" className="w-4 h-4" />
                  Inspect Page
                </>
              )}
            </button>
          </form>

          {appliedNotification && (
            <div className="mt-2.5 p-2 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200 text-xs rounded-lg flex items-center gap-2">
              <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{appliedNotification}</span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-xs rounded-xl flex items-center gap-2">
              <Icon icon="solar:danger-triangle-bold" className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && !data && (
            <div className="py-20 flex flex-col items-center justify-center text-center text-gray-500 space-y-3">
              <Icon icon="solar:spinner-bold" className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Fetching webpage and analyzing visual elements...</p>
              <p className="text-xs text-gray-400 font-mono">{targetUrl}</p>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* IMAGE GALLERIES & SPLIT */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:gallery-bold" className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Detected Image Galleries ({data.galleries?.length || 0})
                    </h4>
                  </div>
                </div>

                {data.galleries && data.galleries.length > 0 ? (
                  data.galleries.map((gallery: any, gIdx: number) => {
                    const firstTag = gallery.firstImageTag;
                    const firstUrl = gallery.firstImageUrl;
                    const remaining = gallery.remainingImages || [];

                    return (
                      <div
                        key={gIdx}
                        className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
                          <div>
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">
                              Gallery #{gIdx + 1}: {gallery.totalImages} images detected
                            </span>
                            <div className="text-[11px] font-mono text-gray-500 truncate max-w-lg mt-0.5">
                              XPath: <span className="text-blue-600">{gallery.genericXpath || gallery.xpath}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => applyGallerySplit(gallery)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <Icon icon="solar:stars-minimalistic-bold" className="w-3.5 h-3.5" />
                            Apply 1st Img Tag + Remaining Gallery
                          </button>
                        </div>

                        {/* Breakdown */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                          <div className="lg:col-span-6 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                                ★ First Image (&lt;img&gt; tag)
                              </span>
                            </div>

                            <div className="flex gap-3 items-center">
                              {firstUrl && (
                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-white shrink-0">
                                  <img
                                    src={firstUrl}
                                    alt={gallery.firstImageAlt || 'first'}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="text-[11px] text-gray-800 dark:text-gray-200 font-mono truncate">
                                  {firstUrl}
                                </div>
                              </div>
                            </div>

                            {firstTag && (
                              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
                                <div className="flex items-center justify-between text-[11px] text-gray-500">
                                  <span>HTML &lt;img&gt; Tag:</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(firstTag)}
                                    className="text-blue-600 hover:underline inline-flex items-center gap-1 font-mono text-[10px] cursor-pointer"
                                  >
                                    {copiedTag ? 'Copied' : 'Copy Tag'}
                                  </button>
                                </div>
                                <div className="p-2 bg-gray-50 dark:bg-gray-950 rounded-lg font-mono text-[11px] text-emerald-600 break-all select-all border border-gray-200 dark:border-gray-800">
                                  {firstTag}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="lg:col-span-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                📷 Remaining Gallery ({remaining.length} Images)
                              </span>
                            </div>

                            {remaining.length > 0 ? (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {remaining.map((imgUrl: string, rIdx: number) => (
                                  <div
                                    key={rIdx}
                                    className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-white"
                                  >
                                    <img
                                      src={imgUrl}
                                      alt={`Gallery ${rIdx + 2}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 text-center text-gray-400 text-xs italic">
                                Only 1 image in this container.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 bg-gray-50 dark:bg-gray-950 rounded-xl text-center text-gray-500 text-xs border border-gray-200 dark:border-gray-800">
                    No multi-image galleries automatically found on this page.
                  </div>
                )}
              </div>

              {/* DETECTED HEADINGS */}
              {data.headings && data.headings.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:text-field-bold" className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Detected Titles &amp; Headings
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.headings.slice(0, 4).map((h: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono uppercase bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded">
                            {h.tag}
                          </span>
                          <div className="text-xs font-semibold text-gray-900 dark:text-white mt-1 line-clamp-2">
                            {h.text}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => addSingleField('title', h.xpath, 'text')}
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-blue-600 hover:text-white text-gray-700 dark:text-gray-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                        >
                          + Set Title
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Configured fields: <span className="text-gray-900 dark:text-white font-semibold">{currentFields.length}</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>Done &amp; Return to Step 3</span>
            <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
