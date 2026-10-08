import { JSDOM } from 'jsdom';

export interface XPathField {
  id: string;
  name: string;
  xpath: string;
  type:
    | 'text'
    | 'html'
    | 'image_url'
    | 'first_image_url'
    | 'image_list'
    | 'first_image_tag'
    | 'gallery_remaining'
    | 'image_tag'
    | 'link_url'
    | 'link_list'
    | 'attribute'
    | 'array_text'
    | 'number';
  attributeName?: string;
  imgTagClass?: string;
  excludeFirstImage?: boolean;
  highResImages?: boolean;
  companionMainImageTag?: boolean;
  description?: string;
}

export function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsolute.trim(), baseUrl).href;
  } catch {
    return relativeOrAbsolute.trim();
  }
}

export function cleanFullResUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/-\d+x\d+(\.[a-zA-Z0-9]+)(\?.*)?$/i, '$1$2');
}

export function buildImgTag(src: string, alt = '', className = ''): string {
  const safeSrc = (src || '').replace(/"/g, '&quot;');
  const safeAlt = (alt || '').replace(/"/g, '&quot;');
  const classAttr = className ? ` class="${className.replace(/"/g, '&quot;')}"` : '';
  return `<img src="${safeSrc}" alt="${safeAlt}"${classAttr} />`;
}

function extractImageSrcFromElement(el: Element, baseUrl: string, highRes = true): string | null {
  if (!el) return null;
  const raw =
    el.getAttribute('data-large_image') ||
    el.getAttribute('data-full-src') ||
    el.getAttribute('data-zoom-image') ||
    el.getAttribute('data-original') ||
    el.getAttribute('data-src') ||
    el.getAttribute('data-lazy-src') ||
    el.getAttribute('nitro-lazy-src') ||
    el.getAttribute('src');

  if (raw && !raw.startsWith('data:')) {
    const full = resolveUrl(raw, baseUrl);
    return highRes ? cleanFullResUrl(full) || full : full;
  }
  return null;
}

function collectImagesFromNode(node: Node, baseUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  if (!node) return urls;

  if (node.nodeType === 1) {
    const el = node as Element;
    if (el.tagName.toLowerCase() === 'img') {
      const src = extractImageSrcFromElement(el, baseUrl);
      if (src && !seen.has(src)) {
        seen.add(src);
        urls.push(src);
      }
    } else {
      const imgs = el.querySelectorAll('img');
      imgs.forEach((img) => {
        const src = extractImageSrcFromElement(img, baseUrl);
        if (src && !seen.has(src)) {
          seen.add(src);
          urls.push(src);
        }
      });
    }
  }

  return urls;
}

export function extractDataWithXPath(
  html: string,
  baseUrl: string,
  fields: XPathField[]
): { data: Record<string, any>; errors: Record<string, string> } {
  const data: Record<string, any> = {};
  const errors: Record<string, string> = {};

  let dom: JSDOM | null = null;
  try {
    dom = new JSDOM(html, {
      url: baseUrl,
      pretendToBeVisual: false,
    });
  } catch (err: any) {
    for (const field of fields) {
      data[field.name] = null;
      errors[field.name] = err.message || 'Failed to parse HTML document';
    }
    return { data, errors };
  }

  try {
    const doc = dom.window.document;
    const XPathResult = dom.window.XPathResult;

    for (const field of fields) {
    if (!field.name || !field.xpath) continue;

    const trimmedXPath = field.xpath.trim();

    try {
      let nodes: Node[] = [];

      const evaluateXPath = (expr: string): Node[] => {
        try {
          const snapshot = doc.evaluate(expr, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          const list: Node[] = [];
          for (let i = 0; i < snapshot.snapshotLength; i++) {
            const item = snapshot.snapshotItem(i);
            if (item) list.push(item);
          }
          return list;
        } catch {
          return [];
        }
      };

      nodes = evaluateXPath(trimmedXPath);

      // Smart fallback: if xpath ended with /ol (WooCommerce client-side slider) but raw HTML has div.woocommerce-product-gallery
      if (nodes.length === 0 && trimmedXPath.includes('/ol')) {
        const withoutOl = trimmedXPath.replace(/\/ol\b/, '');
        nodes = evaluateXPath(withoutOl);
      }

      if (nodes.length === 0) {
        data[field.name] =
          field.type === 'image_list' || field.type === 'gallery_remaining' || field.type === 'link_list' || field.type === 'array_text'
            ? []
            : null;
        continue;
      }

      const firstNode = nodes[0];

      switch (field.type) {
        case 'text': {
          const text = nodes
            .map((n) => (n.textContent || n.nodeValue || '').trim())
            .filter(Boolean)
            .join(' ');
          data[field.name] = text || null;
          break;
        }

        case 'html': {
          const el = firstNode as Element;
          data[field.name] = el.outerHTML || el.textContent || null;
          break;
        }

        case 'first_image_url': {
          let foundSrc: string | null = null;
          for (const n of nodes) {
            const list = collectImagesFromNode(n, baseUrl);
            if (list.length > 0) {
              foundSrc = list[0];
              break;
            }
          }
          data[field.name] = foundSrc;
          break;
        }

        case 'image_url': {
          let foundSrc: string | null = null;
          for (const n of nodes) {
            const list = collectImagesFromNode(n, baseUrl);
            if (list.length > 0) {
              foundSrc = list[0];
              break;
            }
          }
          data[field.name] = foundSrc;
          break;
        }

        case 'first_image_tag':
        case 'image_tag': {
          let foundSrc: string | null = null;
          let alt = '';
          for (const n of nodes) {
            const list = collectImagesFromNode(n, baseUrl);
            if (list.length > 0) {
              foundSrc = list[0];
              const el = n as Element;
              alt = el.getAttribute?.('alt') || doc.querySelector('h1')?.textContent?.trim() || '';
              break;
            }
          }
          if (foundSrc) {
            data[field.name] = buildImgTag(foundSrc, alt, field.imgTagClass);
          } else {
            data[field.name] = null;
          }
          break;
        }

        case 'gallery_remaining': {
          const allImgs: string[] = [];
          const seen = new Set<string>();
          for (const n of nodes) {
            const list = collectImagesFromNode(n, baseUrl);
            for (const s of list) {
              if (!seen.has(s)) {
                seen.add(s);
                allImgs.push(s);
              }
            }
          }
          data[field.name] = allImgs.length > 1 ? allImgs.slice(1) : [];
          break;
        }

        case 'image_list': {
          const allImgs: string[] = [];
          const seen = new Set<string>();
          for (const n of nodes) {
            const list = collectImagesFromNode(n, baseUrl);
            for (const s of list) {
              if (!seen.has(s)) {
                seen.add(s);
                allImgs.push(s);
              }
            }
          }

          if (field.excludeFirstImage) {
            data[field.name] = allImgs.length > 1 ? allImgs.slice(1) : [];
          } else {
            data[field.name] = allImgs;
          }

          if (field.companionMainImageTag && allImgs.length > 0) {
            const firstSrc = allImgs[0];
            const alt = doc.querySelector('h1')?.textContent?.trim() || '';
            data[`${field.name}_main_img_tag`] = buildImgTag(firstSrc, alt);
          }
          break;
        }

        case 'link_url': {
          let href: string | null = null;
          const el = firstNode as Element;
          if (el.getAttribute) {
            href = el.getAttribute('href');
          }
          if (!href && el.querySelector) {
            const a = el.querySelector('a');
            if (a) href = a.getAttribute('href');
          }
          data[field.name] = href ? resolveUrl(href, baseUrl) : null;
          break;
        }

        case 'link_list': {
          const links: string[] = [];
          const seen = new Set<string>();
          for (const n of nodes) {
            const el = n as Element;
            if (el.tagName?.toLowerCase() === 'a' && el.getAttribute?.('href')) {
              const full = resolveUrl(el.getAttribute('href')!, baseUrl);
              if (!seen.has(full)) {
                seen.add(full);
                links.push(full);
              }
            }
            if (el.querySelectorAll) {
              el.querySelectorAll('a').forEach((a) => {
                const h = a.getAttribute('href');
                if (h) {
                  const full = resolveUrl(h, baseUrl);
                  if (!seen.has(full)) {
                    seen.add(full);
                    links.push(full);
                  }
                }
              });
            }
          }
          data[field.name] = links;
          break;
        }

        case 'attribute': {
          const attr = field.attributeName || 'href';
          const el = firstNode as Element;
          const val = el.getAttribute ? el.getAttribute(attr) : null;
          data[field.name] = val;
          break;
        }

        case 'array_text': {
          const texts: string[] = [];
          for (const n of nodes) {
            const el = n as Element;
            if (el.children && el.children.length > 0) {
              Array.from(el.children).forEach((child) => {
                const t = child.textContent?.trim();
                if (t) texts.push(t);
              });
            } else {
              const t = el.textContent?.trim();
              if (t) texts.push(t);
            }
          }
          data[field.name] = texts;
          break;
        }

        case 'number': {
          const text = (firstNode.textContent || firstNode.nodeValue || '').trim();
          const cleaned = text.replace(/[^0-9.,]/g, '');
          if (cleaned) {
            const normalized = cleaned.replace(/,/g, '');
            const parsed = parseFloat(normalized);
            data[field.name] = isNaN(parsed) ? null : parsed;
          } else {
            data[field.name] = null;
          }
          break;
        }

        default: {
          data[field.name] = (firstNode.textContent || firstNode.nodeValue || '').trim();
        }
      }
    } catch (err: any) {
      errors[field.name] = err.message || 'XPath evaluation error';
      data[field.name] = null;
    }
  }
} finally {
  if (dom && dom.window) {
    dom.window.close();
  }
}

  return { data, errors };
}

export async function scrapeUrlWithXPath(
  url: string,
  fields: XPathField[],
  timeoutMs = 25000
): Promise<{
  url: string;
  success: boolean;
  status: number;
  durationMs: number;
  data: Record<string, any>;
  errors: Record<string, string>;
  error?: string;
  scrapedAt: string;
}> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timer);
    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      return {
        url,
        success: false,
        status: res.status,
        durationMs,
        data: {},
        errors: { _http: `HTTP Error ${res.status}: ${res.statusText}` },
        error: `HTTP ${res.status} ${res.statusText}`,
        scrapedAt: new Date().toISOString(),
      };
    }

    const html = await res.text();
    const { data, errors } = extractDataWithXPath(html, url, fields);

    return {
      url,
      success: Object.keys(errors).length === 0,
      status: res.status,
      durationMs,
      data,
      errors,
      scrapedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    clearTimeout(timer);
    const durationMs = Date.now() - startTime;
    const isTimeout = err.name === 'AbortError';

    return {
      url,
      success: false,
      status: isTimeout ? 408 : 500,
      durationMs,
      data: {},
      errors: { _general: isTimeout ? 'Request timed out' : err.message },
      error: isTimeout ? 'Request timed out' : err.message,
      scrapedAt: new Date().toISOString(),
    };
  }
}
