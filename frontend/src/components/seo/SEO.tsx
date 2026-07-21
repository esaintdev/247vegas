import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
}

const SITE_NAME = "247 Vegas";
const SITE_URL = "https://247vegas.live";
const DEFAULT_TITLE = "247 Vegas | Online Casino – Play Slots, Blackjack, Roulette & More";
const DEFAULT_DESC =
  "Play 500+ casino games at 247 Vegas. Slots, Blackjack, Roulette, Poker & more. 24/7 action, fast payouts, secure gaming.";
const DEFAULT_KEYWORDS =
  "247 Vegas, online casino, slots, blackjack, roulette, poker, baccarat, crash game, UK casino";

export default function SEO({
  title,
  description = DEFAULT_DESC,
  keywords = DEFAULT_KEYWORDS,
  ogImage = "/og-image.png",
  ogUrl,
}: SEOProps) {
  const pageTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="title" content={pageTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={ogUrl || SITE_URL} />
      <meta property="og:image" content={ogImage} />
      <meta property="twitter:title" content={pageTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={ogImage} />
    </Helmet>
  );
}
