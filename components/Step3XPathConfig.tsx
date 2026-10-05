'use client';

import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { DynamicField, FieldType, UrlItem } from '@/plugin/data-crawler/types/scraper';
import { PRESETS } from '@/plugin/data-crawler/lib/presets';
import VisualSelectorModal from '@/plugin/data-crawler/components/VisualSelectorModal';

interface Step3XPathConfigProps {
  fields: DynamicField[];
  setFields: React.Dispatch<React.SetStateAction<DynamicField[]>>;
  selectedUrls: UrlItem[];
  onNext: () => void;
  onBack: () => void;
}

const FIELD_TYPES: { value: FieldType; label: string; icon: string; hint: string }[] = [
  { value: 'text', label: 'Text (String)', icon: 'solar:text-field-bold', hint: 'Extracts clean inner text content' },
  {
    value: 'first_image_url',
    label: 'First Image URL (e.g. "image")',
    icon: 'solar:gallery-bold',
    hint: 'Extracts clean URL string like "https://.../3.jpg" from 1st gallery image',
  },
  {
    value: 'first_image_tag',
    label: 'First Image as <img> Tag',
    icon: 'solar:code-file-bold',
    hint: 'Creates <img src="..." alt="..." /> using 1st image from gallery/container',
  },
  {
    value: 'gallery_remaining',
    label: 'Gallery (Excluding 1st Image)',
    icon: 'solar:gallery-wide-bold',
    hint: 'Extracts array of image URLs excluding the 1st image',
  },
  {
    value: 'image_list',
    label: 'Image List (Array of URLs)',
    icon: 'solar:gallery-bold',
    hint: 'Extracts all <img> URLs from container (e.g. <ol> gallery)',
  },
  { value: 'image_url', label: 'Single Image URL', icon: 'solar:gallery-bold', hint: 'Extracts primary image src' },
  { value: 'image_tag', label: 'Image as <img> Tag', icon: 'solar:code-file-bold', hint: 'Creates <img src="..." /> tag' },
  { value: 'number', label: 'Number / Price', icon: 'solar:dollar-bold', hint: 'Extracts numbers, removes currency symbols' },
  { value: 'link_url', label: 'Link URL (href)', icon: 'solar:link-bold', hint: 'Extracts single href URL' },
  { value: 'link_list', label: 'Link List (Array of hrefs)', icon: 'solar:link-bold', hint: 'Extracts all <a> links' },
  { value: 'array_text', label: 'Text Array (List)', icon: 'solar:list-bold', hint: 'Extracts array of text from child elements' },
  { value: 'html', label: 'Raw HTML', icon: 'solar:code-file-bold', hint: 'Extracts outer HTML markup' },
  { value: 'attribute', label: 'Custom Attribute', icon: 'solar:code-file-bold', hint: 'Extracts custom attribute like content, data-*' },
];

export default function Step3XPathConfig({
  fields,
  setFields,
  selectedUrls,
  onNext,
  onBack,
}: Step3XPathConfigProps) {
  const [testSampleUrl, setTestSampleUrl] = useState<string>(
    selectedUrls[0]?.url || 'https://avechi.co.ke/product/samsung-super-fast-wireless-charging-pad-15w/'
  );
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any> | null>(null);
  const [testErrors, setTestErrors] = useState<Record<string, string> | null>(null);
  const [testDuration, setTestDuration] = useState<number | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [isVisualModalOpen, setIsVisualModalOpen] = useState(false);

  const addField = () => {
    const newId = 'field_' + Date.now();
    const newField: DynamicField = {
      id: newId,
      name: `field_${fields.length + 1}`,
      xpath: '//div',
      type: 'text',
    };
    setFields((prev) => [...prev, newField]);
  };

  const removeField = (id: string) => {
    if (fields.length <= 1) return;
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const duplicateField = (field: DynamicField) => {
    const newField: DynamicField = {
      ...field,
      id: 'field_' + Date.now(),
      name: `${field.name}_copy`,
    };
    setFields((prev) => [...prev, newField]);
  };

  const updateField = (id: string, updates: Partial<DynamicField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const loadPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setFields(
        preset.fields.map((f) => ({
          ...f,
          id: 'field_' + Math.random().toString(36).substring(2, 9),
        }))
      );
      setTestResults(null);
    }
  };

  const generalizeXPath = (xpathStr: string) => {
    const idMatch = xpathStr.match(/@id=["']([^"']*\d+[^"']*)["']/);
    if (idMatch) {
      const fullId = idMatch[1];
      const prefix = fullId.replace(/\d+.*$/, '');
      if (prefix) {
        return xpathStr.replace(`@id="${fullId}"`, `contains(@id, "${prefix}")`);
      }
    }
    return xpathStr;
  };

  const generalizeAllFields = () => {
    setFields((prev) =>
      prev.map((f) => {
        let updatedXPath = generalizeXPath(f.xpath);
        if (f.name.toLowerCase().includes('title') && !updatedXPath.includes('//h1')) {
          updatedXPath = `${updatedXPath} | //h1`;
        }
        return { ...f, xpath: updatedXPath };
      })
    );
  };

  const splitMainImageAndGallery = () => {
    setFields((prev) => {
      const galleryField = prev.find(
        (f) => f.type === 'image_list' || f.name.toLowerCase().includes('gallery')
      );
      const galleryXPath =
        galleryField?.xpath ||
        '//*[@id="product-17379"]/div[1]/ol | //ol[contains(@class, "flex-control-thumbs")]';

      const hasImageField = prev.some(
        (f) => f.name === 'image' || f.type === 'first_image_url' || f.name === 'main_image_tag'
      );

      const updated = prev.map((f) => {
        if (f.type === 'image_list' || f.name.toLowerCase().includes('gallery')) {
          return {
            ...f,
            excludeFirstImage: true,
          };
        }
        return f;
      });

      if (!hasImageField) {
        const galleryIdx = updated.findIndex(
          (f) => f.type === 'image_list' || f.name.toLowerCase().includes('gallery')
        );
        const imageField: DynamicField = {
          id: 'field_image_' + Date.now(),
          name: 'image',
          xpath: galleryXPath,
          type: 'first_image_url',
        };

        if (galleryIdx !== -1) {
          updated.splice(galleryIdx, 0, imageField);
        } else {
          updated.push(imageField);
        }
      }

      return updated;
    });
  };

  const runTestOnSample = async () => {
    if (!testSampleUrl) return;

    setIsTesting(true);
    setTestResults(null);
    setTestErrors(null);
    setTestDuration(null);

    try {
      const res = await fetch('/api/data-crawler/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: testSampleUrl,
          fields,
        }),
      });

      const json = await res.json();
      setTestDuration(json.durationMs || 0);

      if (json.success && json.data) {
        setTestResults(json.data);
        if (json.errors) setTestErrors(json.errors);
      } else {
        setTestErrors({ _general: json.error || 'Failed to scrape sample URL' });
      }
    } catch (err: any) {
      setTestErrors({ _general: err.message || 'Network request failed' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-xs mb-1 uppercase tracking-wider">
              <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              Step 3 of 4
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Configure Dynamic XPath Fields
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Define the attributes to extract using field names, XPath selectors, and data types (Text, Image List, Link, etc.).
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <span className="text-xs text-gray-500 font-medium mr-1 flex items-center gap-1">
              <Icon icon="solar:stars-minimalistic-bold" className="w-3.5 h-3.5 text-amber-500" />
              Presets:
            </span>
            <button
              type="button"
              onClick={() => loadPreset('avechi-sample')}
              className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-lg transition-colors font-medium cursor-pointer"
            >
              Avechi Example
            </button>
            <button
              type="button"
              onClick={() => loadPreset('woocommerce-generic')}
              className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              E-Commerce Store
            </button>
            <button
              type="button"
              onClick={() => loadPreset('blog-article')}
              className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Article / Blog
            </button>

            <button
              type="button"
              onClick={splitMainImageAndGallery}
              className="text-xs bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg transition-colors font-medium cursor-pointer flex items-center gap-1.5"
            >
              <Icon icon="solar:gallery-bold" className="w-3.5 h-3.5 text-amber-500" />
              Split Main &amp; Gallery
            </button>

            <button
              type="button"
              onClick={() => setIsVisualModalOpen(true)}
              className="text-xs bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-lg transition-colors font-medium cursor-pointer flex items-center gap-1.5"
            >
              <Icon icon="solar:stars-minimalistic-bold" className="w-3.5 h-3.5 text-emerald-600" />
              Visual Inspector
            </button>
          </div>
        </div>

        {/* Tip / Explanation Banner */}
        <div className="mt-5 p-3.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl flex items-start justify-between gap-3 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-start gap-2.5">
            <Icon icon="solar:info-circle-bold" className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">XPath Pro Tip: </span>
              If your XPath contains a specific post ID (e.g.{' '}
              <code className="text-amber-600 dark:text-amber-400 font-mono">{'//*[@id="product-17379"]'}</code>), click{' '}
              <button
                type="button"
                onClick={generalizeAllFields}
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Auto-Generalize IDs
              </button>{' '}
              so it extracts smoothly across all product pages.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTips(!showTips)}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-white shrink-0 underline"
          >
            {showTips ? 'Hide info' : 'View examples'}
          </button>
        </div>

        {/* Collapsible XPath Examples */}
        {showTips && (
          <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs space-y-2 text-gray-700 dark:text-gray-300 font-mono">
            <div className="text-amber-600 dark:text-amber-400 font-semibold font-sans mb-1">Common XPath Patterns:</div>
            <div>
              <span className="text-blue-600 dark:text-blue-400 font-bold">Title:</span>{' '}
              <code>{'//*[@id="product-17379"]/div[2]/h1 | //h1[contains(@class, \'product_title\')] | //h1'}</code>
            </div>
            <div>
              <span className="text-blue-600 dark:text-blue-400 font-bold">Gallery Images (List):</span>{' '}
              <code>{'//*[@id="product-17379"]/div[1]/ol | //ol[contains(@class, \'flex-control-thumbs\')]'}</code>
            </div>
            <div>
              <span className="text-blue-600 dark:text-blue-400 font-bold">Price:</span>{' '}
              <code>{'//p[contains(@class, \'price\')]//span[contains(@class, \'amount\')]'}</code>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Fields List */}
      <div className="space-y-4">
        {fields.map((field, index) => {
          const testVal = testResults ? testResults[field.name] : undefined;
          const fieldErr = testErrors ? testErrors[field.name] : undefined;
          const hasHardcodedId = field.xpath.includes('product-17379') || /id=["'][^"']*\d{3,}[^"']*["']/.test(field.xpath);

          return (
            <div
              key={field.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 rounded-2xl p-5 transition-all shadow-sm group"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* Field Number & Name */}
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 inline-flex items-center justify-center text-[10px] font-bold">
                      {index + 1}
                    </span>
                    Field Name:
                  </label>
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => updateField(field.id, { name: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                    placeholder="e.g. title, gallery, price"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3.5 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[11px] text-gray-400">JSON key output</div>
                </div>

                {/* XPath Selector Input */}
                <div className="md:col-span-5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                      XPath Expression:
                    </label>
                    {hasHardcodedId && (
                      <button
                        type="button"
                        onClick={() => updateField(field.id, { xpath: generalizeXPath(field.xpath) })}
                        className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-medium"
                      >
                        Generalize ID
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={field.xpath}
                    onChange={(e) => updateField(field.id, { xpath: e.target.value })}
                    placeholder='//*[@id="product-17379"]/div[2]/h1'
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3.5 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                  />
                </div>

                {/* Field Type Selector */}
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                    Extraction Type:
                  </label>
                  <div className="relative">
                    <select
                      value={field.type}
                      onChange={(e) => updateField(field.id, { type: e.target.value as FieldType })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none pr-8"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <Icon icon="solar:alt-arrow-down-linear" className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">
                    {FIELD_TYPES.find((t) => t.value === field.type)?.hint}
                  </div>
                </div>

                {/* Actions: Duplicate / Delete */}
                <div className="md:col-span-1 flex items-center md:justify-end gap-1 pt-6">
                  <button
                    type="button"
                    onClick={() => duplicateField(field)}
                    className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    title="Duplicate field"
                  >
                    <Icon icon="solar:copy-bold" className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => removeField(field.id)}
                    disabled={fields.length <= 1}
                    className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    title="Delete field"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Extra input if attribute type */}
              {field.type === 'attribute' && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3">
                  <span className="text-xs text-gray-500">Attribute Name:</span>
                  <input
                    type="text"
                    value={field.attributeName || ''}
                    onChange={(e) => updateField(field.id, { attributeName: e.target.value })}
                    placeholder="e.g. href, data-src, content, alt"
                    className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-900 dark:text-white font-mono"
                  />
                </div>
              )}

              {/* Special options for Image List / Gallery */}
              {field.type === 'image_list' && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 select-none">
                    <input
                      type="checkbox"
                      checked={field.excludeFirstImage ?? false}
                      onChange={(e) => updateField(field.id, { excludeFirstImage: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-0"
                    />
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      Exclude 1st image from this gallery
                    </span>
                    <span className="text-gray-400 text-[11px]">
                      (Ensures the gallery does not contain that specific first image)
                    </span>
                  </label>
                </div>
              )}

              {/* Live Test Preview */}
              {testResults && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Live Sample Preview:
                    </span>
                    {fieldErr ? (
                      <span className="text-[10px] bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                        Error
                      </span>
                    ) : testVal === null || (Array.isArray(testVal) && testVal.length === 0) ? (
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                        No Match Found
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <Icon icon="solar:check-circle-bold" className="w-3 h-3" /> Matched
                      </span>
                    )}
                  </div>

                  {fieldErr && (
                    <div className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-900">
                      {fieldErr}
                    </div>
                  )}

                  {testVal !== undefined && !fieldErr && (
                    <div className="bg-gray-50 dark:bg-gray-950 rounded-xl p-3 border border-gray-200 dark:border-gray-800 font-mono text-xs">
                      {(field.type === 'image_list' || field.type === 'gallery_remaining') && Array.isArray(testVal) ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-sans">
                            <span className="text-gray-500">
                              Found {testVal.length} images in gallery:
                            </span>
                            {(field.excludeFirstImage || field.type === 'gallery_remaining') && (
                              <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full font-medium">
                                ✓ First image excluded from gallery
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {testVal.map((imgUrl, i) => (
                              <div
                                key={i}
                                className="relative group w-14 h-14 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Thumb ${i}`}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-center text-white truncate px-1">
                                  #{i + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate max-h-16 overflow-y-auto">
                            {JSON.stringify(testVal, null, 2)}
                          </div>
                        </div>
                      ) : (field.type === 'image_url' || field.type === 'first_image_url') && typeof testVal === 'string' ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800">
                            <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white shrink-0">
                              <img src={testVal} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0 font-mono text-xs">
                              <div className="text-blue-600 dark:text-blue-400 truncate select-all">{testVal}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5 font-sans">
                                JSON: &quot;{field.name}&quot;: &quot;{testVal}&quot;
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-800 dark:text-gray-200 wrap-break-word whitespace-pre-wrap">
                          {testVal === null ? (
                            <span className="text-gray-400 italic">null</span>
                          ) : typeof testVal === 'object' ? (
                            JSON.stringify(testVal, null, 2)
                          ) : (
                            String(testVal)
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Field & Global Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={addField}
          className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-white px-4 py-2.5 rounded-xl font-medium text-xs transition-colors cursor-pointer border border-gray-200 dark:border-gray-700 shadow-sm"
        >
          <Icon icon="solar:add-circle-bold" className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Add Another Field
        </button>

        <button
          type="button"
          onClick={generalizeAllFields}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
        >
          <Icon icon="solar:stars-minimalistic-bold" className="w-3.5 h-3.5 text-amber-500" />
          Auto-Generalize Hardcoded IDs
        </button>
      </div>

      {/* Interactive Live Sample Test Sandbox */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Icon icon="solar:play-bold" className="w-4 h-4 text-emerald-600" />
              Live XPath Tester Sandbox
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Test your XPaths against one sample URL before scraping all {selectedUrls.length} pages.
            </p>
          </div>

          <button
            type="button"
            onClick={runTestOnSample}
            disabled={isTesting || !testSampleUrl}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            {isTesting ? (
              <>
                <Icon icon="solar:spinner-bold" className="w-4 h-4 animate-spin" />
                Testing Sample...
              </>
            ) : (
              <>
                <Icon icon="solar:play-bold" className="w-4 h-4" />
                Test XPath Extraction
              </>
            )}
          </button>
        </div>

        {/* Sample URL selector / input */}
        <div className="flex flex-col sm:flex-row gap-2">
          {selectedUrls.length > 0 ? (
            <select
              value={testSampleUrl}
              onChange={(e) => setTestSampleUrl(e.target.value)}
              className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {selectedUrls.map((u, i) => (
                <option key={u.id} value={u.url}>
                  #{i + 1}: {u.url}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={testSampleUrl}
              onChange={(e) => setTestSampleUrl(e.target.value)}
              placeholder="https://avechi.co.ke/product/samsung-super-fast-wireless-charging-pad-15w/"
              className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white font-mono focus:outline-none"
            />
          )}
        </div>

        {testDuration !== null && (
          <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Icon icon="solar:check-circle-bold" className="w-3.5 h-3.5" /> Tested successfully
            </span>
            <span>Duration: {testDuration}ms</span>
          </div>
        )}

        {testErrors?._general && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold" className="w-4 h-4 text-red-500 shrink-0" />
            <span>{testErrors._general}</span>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-xl font-medium transition-colors text-xs cursor-pointer"
        >
          <Icon icon="solar:arrow-left-bold" className="w-4 h-4" />
          <span>Back: Select URLs (Step 2)</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={fields.length === 0}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md shadow-blue-600/20 transition-all text-xs cursor-pointer"
        >
          <span>Next: Start Scraping &amp; View JSON (Step 4)</span>
          <Icon icon="solar:arrow-right-bold" className="w-4 h-4" />
        </button>
      </div>

      {/* Visual Element Selector & Gallery Splitter Modal */}
      <VisualSelectorModal
        isOpen={isVisualModalOpen}
        onClose={() => setIsVisualModalOpen(false)}
        sampleUrl={testSampleUrl}
        onApplyFields={(newFields) => setFields(newFields)}
        currentFields={fields}
      />
    </div>
  );
}
