import { NextRequest, NextResponse } from 'next/server';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { resolveUrl, buildImgTag } from '@/plugin/data-crawler/lib/xpath-scraper';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch page: HTTP ${response.status} ${response.statusText}` },
        { status: 200 }
      );
    }

    const html = await response.text();

    // Sanitize HTML for DOMParser
    let clean = html
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

    const voidTags = ['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'wbr', 'area', 'base', 'col', 'embed', 'param', 'track'];
    for (const tag of voidTags) {
      const regex = new RegExp(`<(${tag}\\b[^>]*?)(?<!/)>`, 'gi');
      clean = clean.replace(regex, '<$1 />');
    }
    clean = clean.replace(/&(?!(?:[a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;');

    let doc: any;
    try {
      doc = new DOMParser({ onError: () => {} }).parseFromString(`<root>${clean}</root>`, 'text/xml');
    } catch {
      doc = null;
    }

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Could not parse HTML document' });
    }

    // 1. Detect Titles & Headings
    const headings: { xpath: string; text: string; tag: string }[] = [];
    const headingNodes = xpath.select('//h1 | //h2 | //*[contains(@class, "product_title")] | //*[contains(@class, "entry-title")]', doc) as any[];
    for (const el of headingNodes) {
      const text = (el.textContent || el.nodeValue || '').trim();
      if (text && text.length > 2 && text.length < 200) {
        const id = el.getAttribute ? el.getAttribute('id') : null;
        const cls = el.getAttribute ? el.getAttribute('class') : null;
        const tagName = (el.tagName || el.nodeName || 'h1').toLowerCase();

        let xpathStr = '';
        if (id) {
          xpathStr = `//*[@id="${id}"]`;
        } else if (cls) {
          const firstCls = cls.trim().split(/\s+/)[0];
          xpathStr = `//${tagName}[contains(@class, '${firstCls}')]`;
        } else {
          xpathStr = `//${tagName}`;
        }
        headings.push({ xpath: xpathStr, text, tag: tagName });
      }
    }

    // 2. Detect Image Galleries & Images
    const galleries: {
      id: string;
      xpath: string;
      genericXpath: string;
      totalImages: number;
      firstImageUrl: string | null;
      firstImageTag: string | null;
      firstImageAlt: string;
      remainingImages: string[];
      allImages: string[];
      previewSnippet: string;
    }[] = [];

    const containerNodes = xpath.select('//ol | //ul | //*[contains(@class, "gallery")] | //*[contains(@class, "image")] | //*[contains(@class, "photos")] | //*[contains(@id, "product")]', doc) as any[];

    for (const container of containerNodes) {
      const imgNodes = xpath.select('.//img', container) as any[];
      if (imgNodes.length >= 2 && imgNodes.length <= 40) {
        const allUrls: string[] = [];
        const seen = new Set<string>();
        let firstAlt = '';

        for (const img of imgNodes) {
          const raw =
            img.getAttribute?.('data-large_image') ||
            img.getAttribute?.('data-src') ||
            img.getAttribute?.('data-lazy-src') ||
            img.getAttribute?.('data-original') ||
            img.getAttribute?.('src');

          if (raw && !raw.startsWith('data:')) {
            const resolved = resolveUrl(raw, targetUrl);
            if (!seen.has(resolved)) {
              seen.add(resolved);
              allUrls.push(resolved);
              if (!firstAlt) firstAlt = img.getAttribute?.('alt') || '';
            }
          }
        }

        if (allUrls.length >= 2 && galleries.length < 6) {
          const id = container.getAttribute ? container.getAttribute('id') : null;
          const cls = container.getAttribute ? container.getAttribute('class') : null;
          const tagName = (container.tagName || container.nodeName || 'div').toLowerCase();

          let specificXpath = '';
          let genericXpath = '';

          if (id) {
            specificXpath = `//*[@id="${id}"]`;
            const genericId = id.replace(/\d+.*$/, '');
            genericXpath = genericId ? `//*[contains(@id, "${genericId}")]` : specificXpath;
          } else if (cls) {
            const firstCls = cls.trim().split(/\s+/)[0];
            specificXpath = `//${tagName}[contains(@class, '${firstCls}')]`;
            genericXpath = specificXpath;
          } else {
            specificXpath = `//${tagName}`;
            genericXpath = specificXpath;
          }

          const firstUrl = allUrls[0] || null;
          const firstTag = firstUrl ? buildImgTag(firstUrl, firstAlt, 'featured-image') : null;
          const remaining = allUrls.slice(1);

          galleries.push({
            id: id || `gallery-${galleries.length}`,
            xpath: specificXpath,
            genericXpath,
            totalImages: allUrls.length,
            firstImageUrl: firstUrl,
            firstImageTag: firstTag,
            firstImageAlt: firstAlt,
            remainingImages: remaining,
            allImages: allUrls,
            previewSnippet: (container.toString?.() || '').slice(0, 300),
          });
        }
      }
    }

    // 3. Detect Price Elements
    const prices: { xpath: string; text: string; priceNum: number | null }[] = [];
    const priceNodes = xpath.select('//*[contains(@class, "price")] | //*[contains(@class, "amount")] | //*[@itemprop="price"] | //bdi', doc) as any[];

    for (const el of priceNodes) {
      const text = (el.textContent || el.nodeValue || '').trim();
      if (text && text.length > 0 && text.length < 50 && /[0-9]/.test(text)) {
        const cls = el.getAttribute ? el.getAttribute('class') : null;
        const tagName = (el.tagName || el.nodeName || 'span').toLowerCase();

        let xpathStr = '';
        if (cls) {
          const firstCls = cls.trim().split(/\s+/)[0];
          xpathStr = `//*[contains(@class, '${firstCls}')]`;
        } else {
          xpathStr = `//${tagName}`;
        }
        const num = parseFloat(text.replace(/[^0-9.]/g, ''));
        prices.push({ xpath: xpathStr, text, priceNum: isNaN(num) ? null : num });
      }
    }

    // 4. Detect Description / Text Content
    const descriptions: { xpath: string; preview: string }[] = [];
    const descNodes = xpath.select('//*[contains(@class, "description")] | //*[@id="tab-description"] | //*[@itemprop="description"] | //article//p', doc) as any[];

    for (const el of descNodes) {
      const text = (el.textContent || el.nodeValue || '').trim();
      if (text && text.length > 20) {
        const id = el.getAttribute ? el.getAttribute('id') : null;
        const cls = el.getAttribute ? el.getAttribute('class') : null;
        const tagName = (el.tagName || el.nodeName || 'div').toLowerCase();

        let xpathStr = '';
        if (id) {
          xpathStr = `//*[@id="${id}"]`;
        } else if (cls) {
          const firstCls = cls.trim().split(/\s+/)[0];
          xpathStr = `//*[contains(@class, '${firstCls}')]`;
        } else {
          xpathStr = `//${tagName}`;
        }
        descriptions.push({ xpath: xpathStr, preview: text.slice(0, 160) + '...' });
      }
    }

    let titleText = '';
    const titleNodes = xpath.select('//title/text()', doc) as any[];
    if (titleNodes && titleNodes.length > 0) {
      titleText = (titleNodes[0].nodeValue || titleNodes[0].textContent || '').trim();
    }

    return NextResponse.json({
      success: true,
      url: targetUrl,
      title: titleText,
      headings,
      galleries,
      prices: prices.slice(0, 4),
      descriptions: descriptions.slice(0, 3),
      htmlLength: html.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Inspection failed' },
      { status: 200 }
    );
  }
}
