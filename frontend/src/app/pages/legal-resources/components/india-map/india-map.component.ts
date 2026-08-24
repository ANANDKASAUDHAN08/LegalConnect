import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  Inject,
  PLATFORM_ID,
  effect
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { IconComponent } from '../../../../components/icon';
import { ThemeService } from '../../../../services/theme.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import * as L from 'leaflet';

export interface StateCoordinateBounds {
  center: [number, number];
  zoom: number;
  bounds?: [[number, number], [number, number]];
}

// Bounding & Center coordinates for all 36 Indian States & UTs
export const INDIA_STATE_COORDINATES: Record<string, StateCoordinateBounds> = {
  'Andhra Pradesh': { center: [15.9129, 79.7400], zoom: 7 },
  'Arunachal Pradesh': { center: [28.2180, 94.7278], zoom: 7 },
  'Assam': { center: [26.2006, 92.9376], zoom: 7 },
  'Bihar': { center: [25.0961, 85.3131], zoom: 7 },
  'Chhattisgarh': { center: [21.2787, 81.8661], zoom: 7 },
  'Goa': { center: [15.2993, 74.1240], zoom: 10 },
  'Gujarat': { center: [22.2587, 71.1924], zoom: 7 },
  'Haryana': { center: [29.0588, 76.0856], zoom: 8 },
  'Himachal Pradesh': { center: [31.1048, 77.1734], zoom: 8 },
  'Jharkhand': { center: [23.6102, 85.2799], zoom: 7 },
  'Karnataka': { center: [15.3173, 75.7139], zoom: 7 },
  'Kerala': { center: [10.8505, 76.2711], zoom: 7 },
  'Madhya Pradesh': { center: [22.9734, 78.6569], zoom: 6 },
  'Maharashtra': { center: [19.7515, 75.7139], zoom: 7 },
  'Manipur': { center: [24.6637, 93.9063], zoom: 8 },
  'Meghalaya': { center: [25.4670, 91.3662], zoom: 8 },
  'Mizoram': { center: [23.1645, 92.9376], zoom: 8 },
  'Nagaland': { center: [26.1584, 94.5624], zoom: 8 },
  'Odisha': { center: [20.9517, 85.0985], zoom: 7 },
  'Punjab': { center: [31.1471, 75.3412], zoom: 8 },
  'Rajasthan': { center: [27.0238, 74.2179], zoom: 6 },
  'Sikkim': { center: [27.5330, 88.5122], zoom: 9 },
  'Tamil Nadu': { center: [11.1271, 78.6569], zoom: 7 },
  'Telangana': { center: [18.1124, 79.0193], zoom: 7 },
  'Tripura': { center: [23.9408, 91.9882], zoom: 9 },
  'Uttar Pradesh': { center: [26.8467, 80.9462], zoom: 6 },
  'Uttarakhand': { center: [30.0668, 79.0193], zoom: 8 },
  'West Bengal': { center: [22.9868, 87.8550], zoom: 7 },
  'Andaman & Nicobar Islands': { center: [11.7401, 92.6586], zoom: 7 },
  'Chandigarh': { center: [30.7333, 76.7794], zoom: 12 },
  'Dadra & Nagar Haveli and Daman & Diu': { center: [20.4283, 72.8397], zoom: 10 },
  'Delhi': { center: [28.6139, 77.2090], zoom: 11 },
  'Jammu & Kashmir': { center: [33.7782, 76.5762], zoom: 7 },
  'Ladakh': { center: [34.1526, 77.5771], zoom: 7 },
  'Lakshadweep': { center: [10.5667, 72.6417], zoom: 9 },
  'Puducherry': { center: [11.9416, 79.8083], zoom: 11 }
};

@Component({
  selector: 'app-india-map',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective],
  templateUrl: './india-map.component.html',
  styleUrls: ['./india-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IndiaMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainerRef!: ElementRef<HTMLDivElement>;

  @Input() resources: any[] = [];
  @Input() stateMetrics: Record<string, number> = {};
  @Input() selectedState = '';
  @Input() activeType = '';
  @Input() totalCount = 0;
  @Input() mapScope: 'page' | 'all' = 'page';
  @Input() hoveredResourceId: string | null = null;
  @Input() isNearMeActive = false;
  @Input() userCoords: { lat: number; lng: number } | null = null;

  @Output() stateSelected = new EventEmitter<string>();
  @Output() resourceSelected = new EventEmitter<any>();
  @Output() typeSelected = new EventEmitter<string>();
  @Output() mapScopeChanged = new EventEmitter<'page' | 'all'>();

  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private userMarker: L.Marker | null = null;
  private tileLayer: L.TileLayer | null = null;
  private markerMap = new Map<string, L.Marker>();

  isMapLoaded = false;
  currentZoom = 5;
  activeTileTheme: 'dark' | 'light' | 'osm' = 'dark';
  totalPlottedPins = 0;

  // Default Pan-India View
  private readonly INDIA_CENTER: [number, number] = [21.5, 78.9];
  private readonly DEFAULT_ZOOM = 4.8;

  constructor(
    private cdr: ChangeDetectorRef,
    public themeService: ThemeService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // Dynamically react to dark/light theme changes
    effect(() => {
      const isDark = this.themeService.isDarkMode();
      if (this.isMapLoaded) {
        this.activeTileTheme = isDark ? 'dark' : 'light';
        this.updateTileLayer();
        this.cdr.markForCheck();
      }
    });
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.initMap();
      }, 100);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map || !this.isMapLoaded) return;

    if (changes['resources']) {
      this.renderResourceMarkers();
    }

    if (changes['selectedState'] && !changes['selectedState'].firstChange) {
      this.zoomToSelectedState();
    }

    if (changes['hoveredResourceId']) {
      this.highlightHoveredMarker(this.hoveredResourceId);
    }

    if (changes['isNearMeActive'] || changes['userCoords']) {
      this.renderUserLocationMarker();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  /** Initialize Leaflet Map Instance */
  private initMap(): void {
    if (!this.mapContainerRef?.nativeElement || this.map) return;

    const isDark = document.documentElement.classList.contains('dark') || this.themeService.isDarkMode();
    this.activeTileTheme = isDark ? 'dark' : 'light';

    this.map = L.map(this.mapContainerRef.nativeElement, {
      center: this.INDIA_CENTER,
      zoom: this.DEFAULT_ZOOM,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false
    });

    // Custom attribution control
    L.control.attribution({ position: 'bottomright', prefix: 'LegalConnect GIS' }).addTo(this.map);

    this.updateTileLayer();

    this.markersLayer = L.layerGroup().addTo(this.map);

    this.map.on('zoomend', () => {
      if (this.map) {
        this.currentZoom = this.map.getZoom();
        this.cdr.markForCheck();
      }
    });

    this.isMapLoaded = true;
    this.renderResourceMarkers();
    this.renderUserLocationMarker();

    if (this.selectedState) {
      this.zoomToSelectedState();
    }

    this.invalidateSize();
    this.cdr.markForCheck();
  }

  /** Force Leaflet container recalculation */
  invalidateSize(): void {
    if (this.map) {
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 150);
    }
  }

  /** Update Tile layer depending on user theme */
  private updateTileLayer(): void {
    if (!this.map) return;

    // Clean up all existing tile layers to avoid stacking or half-tile artifacts
    this.map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        this.map?.removeLayer(layer);
      }
    });

    let tileUrl = '';
    let subdomains: string | string[] = 'abcd';
    let maxZoom = 19;
    let attribution = '';

    if (this.activeTileTheme === 'dark') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      subdomains = 'abcd';
      attribution = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    } else if (this.activeTileTheme === 'light') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      subdomains = 'abcd';
      attribution = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    } else {
      // Standard OpenStreetMap (OSM only supports a, b, c subdomains)
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = 'abc';
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    }

    this.tileLayer = L.tileLayer(tileUrl, {
      maxZoom,
      subdomains,
      attribution
    }).addTo(this.map);

    this.invalidateSize();
  }

  /** Toggle Map Tile Theme (Dark -> Light -> OSM -> Dark) */
  toggleTileTheme(): void {
    if (this.activeTileTheme === 'dark') {
      this.activeTileTheme = 'light';
    } else if (this.activeTileTheme === 'light') {
      this.activeTileTheme = 'osm';
    } else {
      this.activeTileTheme = 'dark';
    }

    this.updateTileLayer();
    this.cdr.markForCheck();
  }

  /** Reset camera and selected state back to all-India */
  resetToAllIndia(): void {
    this.stateSelected.emit('');
    if (this.map) {
      const container = this.mapContainerRef?.nativeElement;
      if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
        try {
          this.map.flyTo(this.INDIA_CENTER, this.DEFAULT_ZOOM, { animate: true, duration: 0.8 });
        } catch {
          this.map.setView(this.INDIA_CENTER, this.DEFAULT_ZOOM);
        }
      } else {
        this.map.setView(this.INDIA_CENTER, this.DEFAULT_ZOOM);
      }
      this.invalidateSize();
    }
  }

  /** Plot all resource coordinate pins on the map */
  private renderResourceMarkers(): void {
    if (!this.map || !this.markersLayer) return;

    this.markersLayer.clearLayers();
    this.markerMap.clear();

    const validCoordinates: L.LatLngExpression[] = [];

    this.resources.forEach((res) => {
      const lat = Number(res.coordinates?.lat || res.coordinates?.latitude);
      const lng = Number(res.coordinates?.lng || res.coordinates?.longitude);

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const iconHtml = this.createMarkerHtml(res);
        const customIcon = L.divIcon({
          className: 'custom-leaflet-marker-wrapper',
          html: iconHtml,
          iconSize: [36, 42],
          iconAnchor: [18, 42],
          popupAnchor: [0, -38]
        });

        const marker = L.marker([lat, lng], { icon: customIcon });

        // Bind interactive rich tooltip on hover (Direction: 'auto' prevents overflowing off-screen!)
        const tooltipHtml = this.createTooltipHtml(res);
        marker.bindTooltip(tooltipHtml, {
          direction: 'auto',
          offset: L.point(0, -28),
          opacity: 1,
          className: 'custom-legal-tooltip',
          sticky: false
        });

        // Bind interactive popup card on click
        const popupHtml = this.createPopupHtml(res);
        marker.bindPopup(popupHtml, {
          closeButton: false,
          offset: L.point(0, -10),
          className: 'custom-legal-popup'
        });

        marker.on('click', () => {
          marker.closeTooltip();
          this.resourceSelected.emit(res);
        });

        this.markersLayer?.addLayer(marker);
        const resourceId = res._id || res.id || res.name;
        this.markerMap.set(resourceId, marker);
        validCoordinates.push([lat, lng]);
      }
    });

    this.totalPlottedPins = validCoordinates.length;

    // If a state is selected and we have pins, fly to pins or state bounds
    if (this.selectedState && INDIA_STATE_COORDINATES[this.selectedState]) {
      this.zoomToSelectedState();
    } else if (validCoordinates.length > 0 && validCoordinates.length <= 20 && !this.selectedState) {
      const container = this.mapContainerRef?.nativeElement;
      if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
        try {
          const bounds = L.latLngBounds(validCoordinates);
          if (bounds.isValid()) {
            this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
          }
        } catch {
          // Prevent unhandled projection error on hidden container
        }
      }
    }

    this.cdr.markForCheck();
  }

  /** Create custom SVG marker HTML string */
  private createMarkerHtml(res: any): string {
    const type = res.type || 'LegalAid';
    let color = '#4f46e5'; // Indigo
    let iconSvg = '';

    switch (type) {
      case 'Court':
        color = '#8b5cf6'; // Purple
        iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line><polygon points="12 2 20 7 4 7"></polygon></svg>`;
        break;
      case 'LegalAid':
        color = '#4f46e5'; // Indigo
        iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
        break;
      case 'PoliceStation':
        color = '#f43f5e'; // Rose
        iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
        break;
      case 'GovernmentOffice':
        color = '#f59e0b'; // Amber
        iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line><line x1="9" y1="14" x2="9" y2="14.01"></line><line x1="15" y1="14" x2="15" y2="14.01"></line><line x1="9" y1="18" x2="9" y2="18.01"></line><line x1="15" y1="18" x2="15" y2="18.01"></line></svg>`;
        break;
      case 'LokAdalat':
      case 'MediationCenter':
        color = '#10b981'; // Emerald
        iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path></svg>`;
        break;
      case 'Notary':
        color = '#0284c7'; // Sky
        iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        break;
      default:
        color = '#6366f1';
        iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="12 8 8 12 12 16 16 12 12 8"></polygon></svg>`;
    }

    return `
      <div class="custom-legal-marker" style="--pin-color: ${color}">
        <div style="
          background: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.35);
          border: 2px solid #ffffff;
        ">
          <div style="transform: rotate(45deg); color: #ffffff; display: flex; align-items: center; justify-content: center;">
            ${iconSvg}
          </div>
        </div>
      </div>
    `;
  }

  /** Create sleek SVG-powered solid HTML hover tooltip (Solid color, no transparency/blur, less rounded) */
  private createTooltipHtml(res: any): string {
    const name = res.name || 'Legal Institution';
    const city = res.city || res.district || '';
    const state = res.state || '';
    const location = city && state ? `${city}, ${state}` : (city || state || 'India');
    const type = res.type || 'Legal Aid';
    const efiling = res.facilities?.hasEfiling;

    const pinSvg = `<svg class="w-3 h-3 text-indigo-400 shrink-0 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
    const zapSvg = `<svg class="w-2.5 h-2.5 text-emerald-400 shrink-0 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
    const checkSvg = `<svg class="w-2.5 h-2.5 text-sky-400 shrink-0 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;

    return `
      <div class="bg-slate-900 text-white border border-slate-700/90 rounded-lg p-2.5 shadow-2xl w-max max-w-[380px] min-w-[200px] pointer-events-none font-sans">
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/25 text-indigo-300 border border-indigo-500/40">${type}</span>

          ${efiling ? `
            <span class="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
              ${zapSvg} <span>e-Filing</span>
            </span>
          ` : `
            <span class="text-[8px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 inline-flex items-center gap-1">
              ${checkSvg} <span>Verified</span>
            </span>
          `}
        </div>

        <div class="text-xs font-black text-white leading-snug mb-1 whitespace-normal break-words">
          ${name}
        </div>

        <div class="text-[11px] text-slate-400 flex items-center gap-1 whitespace-normal break-words">
          ${pinSvg}
          <span class="truncate">${location}</span>
        </div>
      </div>
    `;
  }

  /** Create rich SVG-powered solid HTML popup string (Solid, less rounded) */
  private createPopupHtml(res: any): string {
    const name = res.name || 'Legal Institution';
    const city = res.city || '';
    const state = res.state || '';
    const address = res.address || `${city}, ${state}`;
    const phone = res.contactNumber || '';
    const type = res.type || 'Legal Aid';
    const efiling = res.facilities?.hasEfiling;
    const distanceKm = res.distanceKm;

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + address)}`;

    const pinSvg = `<svg class="w-3.5 h-3.5 text-indigo-500 shrink-0 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
    const zapSvg = `<svg class="w-3 h-3 text-emerald-500 shrink-0 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
    const checkSvg = `<svg class="w-3 h-3 text-sky-500 shrink-0 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    const phoneSvg = `<svg class="w-3 h-3 shrink-0 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
    const navSvg = `<svg class="w-3 h-3 shrink-0 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>`;

    return `
      <div class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-2xl min-w-[260px] max-w-[320px] font-sans">
        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">${type}</span>

          ${distanceKm ? `
            <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
              ${pinSvg} <span>${distanceKm} km away</span>
            </span>
          ` : ''}
        </div>

        <h4 class="text-sm font-black text-slate-900 dark:text-white leading-snug mb-1.5">${name}</h4>

        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3 flex items-start gap-1">
          ${pinSvg}
          <span>${address}</span>
        </p>

        <div class="flex flex-wrap gap-1 mb-3">
          ${efiling ? `
            <span class="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
              ${zapSvg} <span>e-Filing Desk</span>
            </span>
          ` : ''}
          <span class="text-[9px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 inline-flex items-center gap-1">
            ${checkSvg} <span>Verified Record</span>
          </span>
        </div>

        <div class="flex items-center gap-2 pt-2.5 border-t border-slate-200 dark:border-slate-800">
          ${phone ? `
            <a href="tel:${phone}" class="flex-1 text-center py-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center gap-1.5 no-underline">
              ${phoneSvg} <span>Call</span>
            </a>
          ` : ''}

          <a href="${mapsUrl}" target="_blank" rel="noopener" class="flex-1 text-center py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all inline-flex items-center justify-center gap-1.5 no-underline">
            ${navSvg} <span>Navigate</span>
          </a>
        </div>
      </div>
    `;
  }

  /** Render user's real GPS beacon */
  private renderUserLocationMarker(): void {
    if (!this.map) return;

    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
      this.userMarker = null;
    }

    if (this.isNearMeActive && this.userCoords && !isNaN(this.userCoords.lat) && !isNaN(this.userCoords.lng)) {
      const container = this.mapContainerRef?.nativeElement;
      const isValidContainer = container && container.offsetWidth > 0 && container.offsetHeight > 0;

      const gpsIcon = L.divIcon({
        className: 'user-gps-marker-wrapper',
        html: `
          <div class="user-gps-marker">
            <div class="gps-pulse"></div>
            <div class="gps-dot"></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const gpsPinSvg = `<svg class="w-3.5 h-3.5 text-indigo-400 shrink-0 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

      this.userMarker = L.marker([this.userCoords.lat, this.userCoords.lng], { icon: gpsIcon })
        .bindPopup(`
          <div class="bg-slate-900 text-white border border-slate-700/80 rounded-md py-1.5 px-2.5 shadow-xl flex items-center gap-1.5 text-xs font-bold font-sans">
            ${gpsPinSvg} <span>Your Current GPS Location</span>
          </div>
        `)
        .addTo(this.map);

      if (isValidContainer) {
        try {
          this.map.flyTo([this.userCoords.lat, this.userCoords.lng], 12, { animate: true, duration: 1.2 });
        } catch {
          this.map.setView([this.userCoords.lat, this.userCoords.lng], 12);
        }
      }
    }
  }

  /** Smoothly fly camera to selected state boundary */
  private zoomToSelectedState(): void {
    if (!this.map) return;

    const container = this.mapContainerRef?.nativeElement;
    // If container is hidden (e.g. desktop map hidden on mobile view), skip animated flyTo
    if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
      return;
    }

    if (!this.selectedState) {
      try {
        this.map.flyTo(this.INDIA_CENTER, this.DEFAULT_ZOOM, { animate: true, duration: 1 });
      } catch {
        this.map.setView(this.INDIA_CENTER, this.DEFAULT_ZOOM);
      }
      return;
    }

    const stateCoord = INDIA_STATE_COORDINATES[this.selectedState];
    if (stateCoord && !isNaN(stateCoord.center[0]) && !isNaN(stateCoord.center[1])) {
      try {
        this.map.flyTo(stateCoord.center, stateCoord.zoom, { animate: true, duration: 1.2 });
      } catch {
        this.map.setView(stateCoord.center, stateCoord.zoom);
      }
    }
  }

  /** Highlight map pin when card is hovered in list */
  private highlightHoveredMarker(resourceId: string | null): void {
    this.markerMap.forEach((marker, id) => {
      const el = marker.getElement();
      if (el) {
        if (id === resourceId) {
          el.classList.add('is-hovered');
          marker.setZIndexOffset(1000);
        } else {
          el.classList.remove('is-hovered');
          marker.setZIndexOffset(0);
        }
      }
    });
  }

  // Floating Control Actions
  zoomIn(): void {
    this.map?.zoomIn();
  }

  zoomOut(): void {
    this.map?.zoomOut();
  }

  selectType(type: string): void {
    this.typeSelected.emit(type);
  }

  setMapScope(scope: 'page' | 'all'): void {
    this.mapScope = scope;
    this.mapScopeChanged.emit(scope);
  }
}