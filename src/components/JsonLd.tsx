import { useEffect, useRef } from 'react';

interface JsonLdProps {
  data: Record<string, any>;
}

const JsonLd = ({ data }: JsonLdProps) => {
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }
    };
  }, [data]);

  return null;
};

export default JsonLd;

// ── Reusable Schema Generators ──

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'مطبعتي',
  alternateName: 'Matbaty',
  url: 'https://matbaty.com',
  logo: 'https://matbaty.com/logo.png',
  description: 'خدمات طباعة احترافية أونلاين في العراق - كروت شخصية، فلايرات، وصولات، ترويسة، قوائم طعام، ودعوات.',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'IQ',
    addressLocality: 'بغداد',
    addressRegion: 'بغداد',
  },
  areaServed: {
    '@type': 'Country',
    name: 'العراق',
  },
  sameAs: [],
};

export const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': 'https://matbaty.com/#business',
  name: 'مطبعتي',
  alternateName: 'Matbaty',
  url: 'https://matbaty.com',
  logo: 'https://matbaty.com/logo.png',
  image: 'https://matbaty.com/logo.png',
  description: 'مطبعتي - خدمات طباعة أونلاين في العراق. تصميم وطباعة كروت شخصية، فلايرات، وصولات، ترويسة، قوائم طعام، ودعوات بجودة عالية وتوصيل سريع.',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'IQ',
    addressLocality: 'بغداد',
    addressRegion: 'بغداد',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 33.3152,
    longitude: 44.3661,
  },
  areaServed: {
    '@type': 'Country',
    name: 'العراق',
  },
  priceRange: '$$',
  currenciesAccepted: 'IQD',
  paymentAccepted: 'Cash',
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'مطبعتي',
  alternateName: 'Matbaty',
  url: 'https://matbaty.com',
  inLanguage: 'ar',
  description: 'خدمات طباعة احترافية أونلاين في العراق',
};

export const breadcrumbSchema = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: `https://matbaty.com${item.url}`,
  })),
});
