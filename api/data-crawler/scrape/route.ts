import { NextRequest, NextResponse } from 'next/server';
import { extractDataWithXPath, XPathField } from '@/plugin/data-crawler/lib/xpath-scraper';

export const maxDuration = 60; // Allow sufficient time for slow websites

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { url, fields, rawHtml } = body;

    if (!url && !rawHtml) {
      return NextResponse.json(
        { success: false, error: 'Target URL or raw HTML is required' },
        { status: 400 }
      );
    }

    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one XPath field definition is required' },
        { status: 400 }
      );
    }

    let html = rawHtml;
    let finalUrl = url || 'http://localhost';

    if (!html) {
      let targetUrl = url.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }
      finalUrl = targetUrl;

      // Abort controller with 25s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      try {
        const response = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept':
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          redirect: 'follow',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return NextResponse.json(
            {
              success: false,
              url: targetUrl,
              error: `HTTP ${response.status}: ${response.statusText}`,
              status: response.status,
              durationMs: Date.now() - startTime,
            },
            { status: 200 } // return 200 with error payload so batch processing doesn't crash
          );
        }

        html = await response.text();
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          {
            success: false,
            url: targetUrl,
            error: fetchErr.name === 'AbortError' ? 'Request timed out after 25s' : fetchErr.message,
            durationMs: Date.now() - startTime,
          },
          { status: 200 }
        );
      }
    }

    // Extract dynamic fields using XPath
    const { data, errors } = extractDataWithXPath(html, finalUrl, fields as XPathField[]);

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      url: finalUrl,
      durationMs,
      data,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      htmlLength: html ? html.length : 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Scraping failed',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
