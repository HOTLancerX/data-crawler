import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';

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
  excludeFirstImage?: boolean;
  highResImages?: boolean;
  companionMainImageTag?: boolean;
  description?: string;
}

export interface ScrapeResult {
  url: string;
  success: boolean;
  status?: number;
  durationMs: number;
  data: Record<string, any>;
  errors?: Record<string, string>;
  error?: string;
  scrapedAt: string;
}

/**
 * Resolves a potentially relative URL against a base URL
 */
export function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string {
  try {
    return new URL(relativeOrAbsolute.trim(), baseUrl).href;
  } catch {
    return relativeOrAbsolute.trim();
  }
}

/**
 * Cleans thumbnail size suffixes (e.g. -300x300.jpg or -100x100.png) into clean full-resolution URLs (3.jpg)
 */
export function cleanFullResUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/-\d+x\d+(\.[a-zA-Z0-9]+)(\?.*)?$/i, '$1$2');
}

/**
 * Builds an <img> HTML tag string with safe attribute escaping
 */
export function buildImgTag(src: string, alt = '', className = ''): string {
  const safeSrc = escapeHtmlAttr(src);
  const safeAlt = escapeHtmlAttr(alt);
  const classAttr = className ? ` class="${escapeHtmlAttr(className)}"` : '';
  return `<img src="${safeSrc}" alt="${safeAlt}"${classAttr} />`;
}

function escapeHtmlAttr(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sanitizes HTML so DOMParser can parse it reliably as XML.
 */
function sanitizeHtml(html: string): string {
  let clean = html
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

  const voidTags = [
    'img',
    'input',
    'br',
    'hr',
    'meta',
    'link',
    'source',
    'wbr',
    'area',
    'base',
    'col',
    'embed',
    'param',
    'track',
  ];
  for (const tag of voidTags) {
    const regex = new RegExp(`<(${tag}\\b[^>]*?)(?<!/)>`, 'gi');
    clean = clean.replace(regex, '<$1 />');
  }

  // Escape lone ampersands
  clean = clean.replace(/&(?!(?:[a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;');

  return `<root>${clean}</root>`;
}

/**
 * Extracts single image URL from a DOM node
 */
function extractImgSrc(node: any, baseUrl: string, cleanFullRes = true): string | null {
  if (!node) return null;

  // If node is an element
  if (node.nodeType === 1) {
    const tagName = (node.tagName || node.nodeName || '').toLowerCase();
    if (tagName === 'img') {
      const raw =
        node.getAttribute?.('data-large_image') ||
        node.getAttribute?.('data-full-src') ||
        node.getAttribute?.('data-zoom-image') ||
        node.getAttribute?.('data-original') ||
        node.getAttribute?.('data-src') ||
        node.getAttribute?.('data-lazy-src') ||
        node.getAttribute?.('nitro-lazy-src') ||
        node.getAttribute?.('src');

      if (raw && !raw.startsWith('data:')) {
        const resolved = resolveUrl(raw, baseUrl);
        return cleanFullRes ? cleanFullResUrl(resolved) || resolved : resolved;
      }
    }
  }

  // Check child nodes recursively
  if (node.childNodes && node.childNodes.length > 0) {
    for (let i = 0; i < node.childNodes.length; i++) {
      const found = extractImgSrc(node.childNodes[i], baseUrl, cleanFullRes);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Recursively extracts all image URLs from a container node or list of nodes
 */
function extractImageList(nodes: any[], baseUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const traverse = (node: any) => {
    if (!node) return;

    if (node.nodeType === 1) {
      const tagName = (node.tagName || node.nodeName || '').toLowerCase();
      if (tagName === 'img') {
        const src = extractImgSrc(node, baseUrl);
        if (src && !seen.has(src)) {
          seen.add(src);
          urls.push(src);
        }
      } else if (tagName === 'a') {
        const href = node.getAttribute?.('href');
        if (href && /\.(jpg|jpeg|png|webp|avif)($|\?)/i.test(href)) {
          const full = resolveUrl(href, baseUrl);
          const clean = cleanFullResUrl(full) || full;
          if (!seen.has(clean)) {
            seen.add(clean);
            urls.push(clean);
          }
        }
      }
    }

    if (node.childNodes && node.childNodes.length > 0) {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i]);
      }
    }
  };

  for (const n of nodes) {
    traverse(n);
  }

  return urls;
}

/**
 * Extracts first image details (src and alt)
 */
function extractFirstImgDetails(
  nodes: any[],
  baseUrl: string,
  doc: any
): { src: string | null; alt: string } {
  let fallbackH1 = '';
  try {
    const h1Nodes = xpath.select('//h1/text()', doc) as any[];
    if (h1Nodes && h1Nodes.length > 0) {
      fallbackH1 = (h1Nodes[0].nodeValue || h1Nodes[0].textContent || '').trim();
    }
  } catch {}

  for (const node of nodes) {
    if (!node) continue;
    const src = extractImgSrc(node, baseUrl);
    if (src) {
      const alt =
        (node.getAttribute ? node.getAttribute('alt') : null) || fallbackH1;
      return { src, alt };
    }
  }

  return { src: null, alt: fallbackH1 };
}

/**
 * Executes dynamic XPath extraction on HTML string
 */
export function extractDataWithXPath(
  html: string,
  baseUrl: string,
  fields: XPathField[]
): { data: Record<string, any>; errors: Record<string, string> } {
  const cleanXml = sanitizeHtml(html);

  let doc: any;
  try {
    doc = new DOMParser({
      onError: () => {},
    }).parseFromString(cleanXml, 'text/xml');
  } catch {
    doc = null;
  }

  const data: Record<string, any> = {};
  const errors: Record<string, string> = {};

  if (!doc) {
    for (const field of fields) {
      data[field.name] = null;
      errors[field.name] = 'Failed to parse HTML document';
    }
    return { data, errors };
  }

  for (const field of fields) {
    if (!field.name || !field.xpath) continue;

    const trimmedXPath = field.xpath.trim();

    try {
      let nodes: any[] = [];
      try {
        const res = xpath.select(trimmedXPath, doc);
        nodes = Array.isArray(res) ? res : [res];
      } catch (e: any) {
        errors[field.name] = e.message || 'Invalid XPath expression';
        data[field.name] = null;
        continue;
      }

      if (!nodes || nodes.length === 0) {
        data[field.name] =
          field.type === 'image_list' ||
          field.type === 'link_list' ||
          field.type === 'array_text'
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
          data[field.name] =
            firstNode.toString?.() || firstNode.textContent || null;
          break;
        }

        case 'first_image_url': {
          const imgList = extractImageList(nodes, baseUrl);
          let firstUrl =
            imgList.length > 0 ? imgList[0] : extractImgSrc(firstNode, baseUrl);
          if (firstUrl) {
            firstUrl = cleanFullResUrl(firstUrl);
          }
          data[field.name] = firstUrl;
          break;
        }

        case 'image_url': {
          const src = extractImgSrc(firstNode, baseUrl);
          data[field.name] = src;
          break;
        }

        case 'first_image_tag':
        case 'image_tag': {
          const { src, alt } = extractFirstImgDetails(nodes, baseUrl, doc);
          if (src) {
            data[field.name] = buildImgTag(src, alt);
          } else {
            data[field.name] = null;
          }
          break;
        }

        case 'gallery_remaining': {
          const imgList = extractImageList(nodes, baseUrl);
          data[field.name] = imgList.length > 1 ? imgList.slice(1) : [];
          break;
        }

        case 'image_list': {
          const imgList = extractImageList(nodes, baseUrl);

          if (field.excludeFirstImage) {
            data[field.name] = imgList.length > 1 ? imgList.slice(1) : [];
          } else {
            data[field.name] = imgList;
          }

          if (field.companionMainImageTag && imgList.length > 0) {
            const firstSrc = imgList[0];
            const { alt } = extractFirstImgDetails(nodes, baseUrl, doc);
            data[`${field.name}_main_img_tag`] = buildImgTag(firstSrc, alt);
          }
          break;
        }

        case 'link_url': {
          let href = firstNode.getAttribute?.('href');
          if (!href && firstNode.childNodes) {
            for (let i = 0; i < firstNode.childNodes.length; i++) {
              const c = firstNode.childNodes[i];
              if (c.getAttribute && c.getAttribute('href')) {
                href = c.getAttribute('href');
                break;
              }
            }
          }
          data[field.name] = href ? resolveUrl(href, baseUrl) : null;
          break;
        }

        case 'link_list': {
          const links: string[] = [];
          const seen = new Set<string>();

          const collectLinks = (n: any) => {
            if (!n) return;
            if (n.nodeType === 1 && (n.tagName || n.nodeName || '').toLowerCase() === 'a') {
              const h = n.getAttribute?.('href');
              if (h) {
                const full = resolveUrl(h, baseUrl);
                if (!seen.has(full)) {
                  seen.add(full);
                  links.push(full);
                }
              }
            }
            if (n.childNodes && n.childNodes.length > 0) {
              for (let i = 0; i < n.childNodes.length; i++) {
                collectLinks(n.childNodes[i]);
              }
            }
          };

          for (const n of nodes) {
            collectLinks(n);
          }

          data[field.name] = links;
          break;
        }

        case 'attribute': {
          const attr = field.attributeName || 'href';
          const val = firstNode.getAttribute ? firstNode.getAttribute(attr) : null;
          data[field.name] = val;
          break;
        }

        case 'array_text': {
          const texts: string[] = [];
          for (const n of nodes) {
            if (n.childNodes && n.childNodes.length > 0) {
              for (let i = 0; i < n.childNodes.length; i++) {
                const child = n.childNodes[i];
                if (child.nodeType === 1) {
                  const t = (child.textContent || child.nodeValue || '').trim();
                  if (t) texts.push(t);
                }
              }
            } else {
              const t = (n.textContent || n.nodeValue || '').trim();
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

  return { data, errors };
}
