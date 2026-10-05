import { NextRequest, NextResponse } from 'next/server';
import { DOMParser } from '@xmldom/xmldom';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, customXml } = body;

    let xmlText = '';

    if (customXml && typeof customXml === 'string') {
      xmlText = customXml;
    } else if (url && typeof url === 'string') {
      let targetUrl = url.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      // Fetch sitemap with realistic browser headers
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/xml,text/xml,*/*;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        next: { revalidate: 60 },
      });

      if (!res.ok) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch sitemap: HTTP ${res.status} ${res.statusText}`,
          },
          { status: res.status }
        );
      }

      xmlText = await res.text();
    } else {
      return NextResponse.json(
        { success: false, error: 'A sitemap URL or custom XML content is required' },
        { status: 400 }
      );
    }

    if (!xmlText || xmlText.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'The sitemap response was empty' },
        { status: 400 }
      );
    }

    // Parse the XML
    const urls: string[] = [];
    const subSitemaps: string[] = [];
    let isIndex = false;

    try {
      const parser = new DOMParser({
        errorHandler: {
          warning: () => {},
          error: () => {},
          fatalError: () => {},
        } as any,
      });
      const doc = parser.parseFromString(xmlText, 'text/xml');

      // Check for <sitemapindex>
      const sitemapNodes = doc.getElementsByTagName('sitemap');
      if (sitemapNodes && sitemapNodes.length > 0) {
        isIndex = true;
        for (let i = 0; i < sitemapNodes.length; i++) {
          const locEl = sitemapNodes[i].getElementsByTagName('loc')[0];
          if (locEl && locEl.textContent) {
            const loc = locEl.textContent.trim();
            if (loc) subSitemaps.push(loc);
          }
        }
      }

      // Check for <urlset> -> <url><loc>
      const urlNodes = doc.getElementsByTagName('url');
      if (urlNodes && urlNodes.length > 0) {
        for (let i = 0; i < urlNodes.length; i++) {
          const locEl = urlNodes[i].getElementsByTagName('loc')[0];
          if (locEl && locEl.textContent) {
            const loc = locEl.textContent.trim();
            if (loc) urls.push(loc);
          }
        }
      }
    } catch {
      // Fallback regex if DOMParser encounters severe issues
    }

    // If DOMParser found nothing, fallback to robust RegExp extraction
    if (urls.length === 0 && subSitemaps.length === 0) {
      const sitemapRegex = /<sitemap>[\s\S]*?<loc>\s*(https?:\/\/[^\s<>]+)\s*<\/loc>[\s\S]*?<\/sitemap>/gi;
      let match;
      while ((match = sitemapRegex.exec(xmlText)) !== null) {
        isIndex = true;
        subSitemaps.push(match[1].trim());
      }

      const urlRegex = /<url>[\s\S]*?<loc>\s*(https?:\/\/[^\s<>]+)\s*<\/loc>[\s\S]*?<\/url>/gi;
      while ((match = urlRegex.exec(xmlText)) !== null) {
        urls.push(match[1].trim());
      }

      // If still nothing, extract all <loc>...</loc>
      if (urls.length === 0 && subSitemaps.length === 0) {
        const rawLocRegex = /<loc>\s*(https?:\/\/[^\s<>]+)\s*<\/loc>/gi;
        while ((match = rawLocRegex.exec(xmlText)) !== null) {
          const found = match[1].trim();
          if (found.endsWith('.xml') || found.includes('sitemap')) {
            subSitemaps.push(found);
          } else {
            urls.push(found);
          }
        }
      }
    }

    // Deduplicate
    const uniqueUrls = Array.from(new Set(urls));
    const uniqueSubSitemaps = Array.from(new Set(subSitemaps));

    return NextResponse.json({
      success: true,
      isIndex,
      urls: uniqueUrls,
      count: uniqueUrls.length,
      subSitemaps: uniqueSubSitemaps,
      subSitemapsCount: uniqueSubSitemaps.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An error occurred while parsing the sitemap',
      },
      { status: 500 }
    );
  }
}
