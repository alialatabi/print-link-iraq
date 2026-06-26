import { useEffect } from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  type?: string;
  image?: string;
  noindex?: boolean;
}

const BASE_URL = 'https://matbaty.com';
const DEFAULT_TITLE = 'مطبعتي | خدمات طباعة احترافية في العراق';
const DEFAULT_DESC = 'مطبعتي - خدمات طباعة أونلاين في العراق. كروت شخصية، فلايرات، وصولات، ترويسة، قوائم طعام، ودعوات. اختر قالباً، خصّصه، واستلمه لباب بيتك.';
const DEFAULT_IMAGE = 'https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/3f83c4dc-4139-4a27-ac19-42d1777ef38e/id-preview-efb191ea--2102bc5b-4765-4e34-a44d-b03d9c6755b7.lovable.app-1771292469981.png';

const SEOHead = ({
  title,
  description,
  canonical,
  type = 'website',
  image,
  noindex = false,
}: SEOHeadProps): null => {
  const fullTitle = title ? `${title} | مطبعتي` : DEFAULT_TITLE;
  const desc = description || DEFAULT_DESC;
  const canonicalUrl = canonical ? `${BASE_URL}${canonical}` : undefined;
  const ogImage = image || DEFAULT_IMAGE;

  useEffect(() => {
    // Title
    document.title = fullTitle;

    // Helper to set/create meta tags
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Standard meta
    setMeta('name', 'description', desc);
    if (noindex) {
      setMeta('name', 'robots', 'noindex, nofollow');
    } else {
      const robotsEl = document.querySelector('meta[name="robots"]');
      if (robotsEl) robotsEl.remove();
    }

    // Open Graph
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:image', ogImage);
    setMeta('property', 'og:locale', 'ar_IQ');
    setMeta('property', 'og:site_name', 'مطبعتي');
    if (canonicalUrl) setMeta('property', 'og:url', canonicalUrl);

    // Twitter
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', ogImage);

    // Canonical
    let linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonicalUrl) {
      if (!linkCanonical) {
        linkCanonical = document.createElement('link');
        linkCanonical.setAttribute('rel', 'canonical');
        document.head.appendChild(linkCanonical);
      }
      linkCanonical.setAttribute('href', canonicalUrl);
    } else if (linkCanonical) {
      linkCanonical.remove();
    }

    return () => {
      // Reset title on unmount to default
      document.title = DEFAULT_TITLE;
    };
  }, [fullTitle, desc, canonicalUrl, type, ogImage, noindex]);

  return null;
};

export default SEOHead;
