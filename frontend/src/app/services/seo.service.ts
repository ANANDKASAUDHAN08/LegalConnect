import { DOCUMENT } from '@angular/common';
import { Injectable, Inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface SeoConfig {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
}

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private readonly defaultTitle = 'LegalConnect — Access to Justice for Every Citizen';
  private readonly defaultDescription = "LegalConnect is India's premier legal platform. Search bare acts, navigate new criminal laws (BNS, BNSS, BSA), access legal document templates, and connect with verified legal advocates.";
  private readonly defaultImage = 'https://legalconnect.co/assets/icons/icon-512x512.png';
  private readonly domain = 'https://legalconnect.co';

  constructor(
    private titleService: Title,
    private metaService: Meta,
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.listenToRouteChanges();
  }

  /**
   * Listen to router events to auto-update Canonical URL and default meta tags on navigation
   */
  private listenToRouteChanges(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const currentUrl = this.domain + (event.urlAfterRedirects || event.url);
        this.setCanonicalUrl(currentUrl);
        this.metaService.updateTag({ property: 'og:url', content: currentUrl });
      });
  }

  /**
   * Set or update dynamic SEO meta tags, title, OG tags, canonical URL, and JSON-LD structured data
   */
  public updateSeo(config: SeoConfig = {}): void {
    const title = config.title ? `${config.title}` : this.defaultTitle;
    const description = config.description || this.defaultDescription;
    const image = config.image || this.defaultImage;
    const url = config.url || (this.domain + this.router.url);
    const type = config.type || 'website';
    const keywords = config.keywords || 'LegalConnect, Indian Law, Bare Acts, Advocates, Legal Aid, IPC to BNS, Lawyer Directory, Legal Templates';

    // 1. Page Title
    this.titleService.setTitle(title);

    // 2. Standard Meta Tags
    this.metaService.updateTag({ name: 'description', content: description });
    this.metaService.updateTag({ name: 'keywords', content: keywords });

    // 3. Robots Control
    if (config.noIndex) {
      this.metaService.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    } else {
      this.metaService.updateTag({ name: 'robots', content: 'index, follow' });
    }

    // 4. Open Graph Tags (Facebook, WhatsApp, LinkedIn)
    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: description });
    this.metaService.updateTag({ property: 'og:image', content: image });
    this.metaService.updateTag({ property: 'og:url', content: url });
    this.metaService.updateTag({ property: 'og:type', content: type });
    this.metaService.updateTag({ property: 'og:site_name', content: 'LegalConnect' });

    // 5. Twitter Card Tags
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: title });
    this.metaService.updateTag({ name: 'twitter:description', content: description });
    this.metaService.updateTag({ name: 'twitter:image', content: image });

    // 6. Canonical Link
    this.setCanonicalUrl(url);

    // 7. Structured Data (JSON-LD)
    if (config.jsonLd) {
      this.setJsonLd(config.jsonLd);
    }
  }

  /**
   * Inject or update canonical URL in document head
   */
  public setCanonicalUrl(url: string): void {
    let link: HTMLLinkElement | null = this.document.querySelector("link[rel='canonical']");
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /**
   * Inject or update dynamic Schema.org JSON-LD script tag
   */
  public setJsonLd(schemaData: Record<string, any> | Array<Record<string, any>>): void {
    let script: HTMLScriptElement | null = this.document.querySelector("script[type='application/ld+json']#dynamic-jsonld");
    if (!script) {
      script = this.document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('id', 'dynamic-jsonld');
      this.document.head.appendChild(script);
    }
    script.text = JSON.stringify(schemaData);
  }
}