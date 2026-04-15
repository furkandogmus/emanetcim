import { getSiteBaseUrl } from "@/lib/site-urls";

type FaqItem = {
  question: string;
  answer: string;
};

/**
 * Generic FAQPage JSON-LD builder for content-heavy landing pages.
 */
export function buildFaqJsonLd(input: {
  locale: string;
  path: string;
  items: FaqItem[];
}) {
  const base = getSiteBaseUrl();
  const pageUrl = `${base}/${input.locale}${input.path}`;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: input.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
    url: pageUrl,
  };
}
export function buildFaqPageJsonLd(
  items: { question: string; answer: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
