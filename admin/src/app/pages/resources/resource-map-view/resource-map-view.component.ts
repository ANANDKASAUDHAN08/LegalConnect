import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LegalResourceItem } from '../../legal-content/legal-content.models';
import { INDIAN_STATES } from '../../../core/constants/geo.constants';
import { AdminApiService } from '../../../core/admin-api.service';

declare var google: any;

interface MapPoint {
  id: string;
  name: string;
  type: string;
  address?: string;
  state?: string;
  district?: string;
  city?: string;
  contactNumber?: string | string[];
  status?: string;
  coordinates: { lat: number; lng: number };
}

@Component({
  selector: 'admin-resource-map-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resource-map-view.component.html',
  styleUrls: ['./resource-map-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceMapViewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() resources: LegalResourceItem[] = [];
  @Input() loading = false;
  @Output() inspectResource = new EventEmitter<LegalResourceItem>();

  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef<HTMLDivElement>;

  map: any = null;
  markers: any[] = [];
  infoWindow: any = null;
  selectedFilterType: 'ALL' | 'Court' | 'LegalAid' | 'PoliceStation' | 'GovernmentOffice' = 'ALL';

  // Coverage telemetry
  stateCounts: Record<string, number> = {};
  gapStates: string[] = [];
  wellCoveredStates: string[] = [];
  totalMappedCount = 0;
  isGeoJsonLoading = false;
  allMapPoints: MapPoint[] = [];

  // Dark Mode Map Styles
  private darkMapStyles = [
    { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
    {
      featureType: 'administrative.locality',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#cbd5e1' }]
    },
    {
      featureType: 'poi',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#64748b' }]
    },
    {
      featureType: 'poi.park',
      elementType: 'geometry',
      stylers: [{ color: '#1e293b' }]
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#334155' }]
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#1e293b' }]
    },
    {
      featureType: 'road',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#94a3b8' }]
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [{ color: '#475569' }]
    },
    {
      featureType: 'transit',
      elementType: 'geometry',
      stylers: [{ color: '#1e293b' }]
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#0284c7' }, { lightness: -50 }]
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#0284c7' }]
    }
  ];

  constructor(
    private api: AdminApiService,
    private cdr: ChangeDetectorRef
  ) { }

  ngAfterViewInit(): void {
    this.initMap();
    this.loadNationwideGeoJson();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resources']) {
      if (this.allMapPoints.length === 0) {
        this.syncFromInputResources();
      }
    }
  }

  ngOnDestroy(): void {
    this.clearMarkers();
    if (this.infoWindow) {
      this.infoWindow.close();
    }
  }

  private loadNationwideGeoJson(): void {
    this.isGeoJsonLoading = true;
    this.cdr.markForCheck();

    this.api.getResourceGeoJson().subscribe({
      next: (res: any) => {
        this.isGeoJsonLoading = false;
        if (res?.features && Array.isArray(res.features)) {
          this.allMapPoints = res.features.map((f: any) => ({
            id: f.properties?.id || f.id,
            name: f.properties?.name || 'Institution',
            type: f.properties?.type || 'Court',
            address: f.properties?.address,
            state: f.properties?.state || '',
            district: f.properties?.district,
            city: f.properties?.city,
            contactNumber: f.properties?.contactNumber,
            status: f.properties?.status || (f.properties?.isVerified ? 'approved' : 'pending'),
            coordinates: {
              lng: f.geometry?.coordinates[0],
              lat: f.geometry?.coordinates[1]
            }
          }));
          this.calculateCoverageGaps();
          if (this.map) {
            this.renderMarkers();
          }
        } else {
          this.syncFromInputResources();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isGeoJsonLoading = false;
        this.syncFromInputResources();
        this.cdr.markForCheck();
      }
    });
  }

  private syncFromInputResources(): void {
    this.allMapPoints = this.resources
      .filter(r => r.coordinates?.lat && r.coordinates?.lng)
      .map(r => ({
        id: r._id || r.id || '',
        name: r.name,
        type: r.type,
        address: r.address,
        state: r.state,
        district: r.district,
        city: r.city,
        contactNumber: r.contactNumber,
        status: r.status,
        coordinates: { lat: r.coordinates!.lat, lng: r.coordinates!.lng }
      }));
    this.calculateCoverageGaps();
    if (this.map) {
      this.renderMarkers();
    }
  }

  private initMap(): void {
    if (typeof google === 'undefined' || !google.maps || !this.mapContainer) {
      return;
    }

    const defaultCenter = { lat: 22.5937, lng: 78.9629 }; // India Center

    this.map = new google.maps.Map(this.mapContainer.nativeElement, {
      center: defaultCenter,
      zoom: 5,
      styles: this.darkMapStyles,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM
      }
    });

    this.infoWindow = new google.maps.InfoWindow();

    // Listen for global inspect clicks triggered from InfoWindow HTML
    (window as any)._adminInspectResourceById = (id: string) => {
      const found = this.resources.find(r => (r._id || r.id) === id) ||
        this.allMapPoints.find(p => p.id === id);
      if (found) {
        this.inspectResource.emit(found as any);
      }
    };

    this.renderMarkers();
  }

  setFilterType(type: 'ALL' | 'Court' | 'LegalAid' | 'PoliceStation' | 'GovernmentOffice'): void {
    this.selectedFilterType = type;
    this.renderMarkers();
    this.cdr.markForCheck();
  }

  private clearMarkers(): void {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
  }

  private renderMarkers(): void {
    if (!this.map || typeof google === 'undefined') return;

    this.clearMarkers();
    const bounds = new google.maps.LatLngBounds();
    let validCount = 0;

    const source = this.allMapPoints.length > 0 ? this.allMapPoints : this.resources.map(r => ({
      id: r._id || r.id || '',
      name: r.name,
      type: r.type,
      address: r.address,
      state: r.state,
      district: r.district,
      city: r.city,
      contactNumber: r.contactNumber,
      status: r.status,
      coordinates: r.coordinates || { lat: 0, lng: 0 }
    }));

    const filtered = source.filter(r => {
      if (this.selectedFilterType === 'ALL') return true;
      return r.type === this.selectedFilterType;
    });

    filtered.forEach(r => {
      if (!r.coordinates || typeof r.coordinates.lat !== 'number' || typeof r.coordinates.lng !== 'number' ||
          (r.coordinates.lat === 0 && r.coordinates.lng === 0)) {
        return;
      }

      const pos = { lat: r.coordinates.lat, lng: r.coordinates.lng };
      bounds.extend(pos);
      validCount++;

      const color = this.getTypeMarkerColor(r.type);
      const marker = new google.maps.Marker({
        position: pos,
        map: this.map,
        title: r.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6.5,
          fillColor: color,
          fillOpacity: 0.9,
          strokeWeight: 1.5,
          strokeColor: '#ffffff'
        }
      });

      marker.addListener('click', () => {
        this.openInfoWindowForPoint(r, marker);
      });

      this.markers.push(marker);
    });

    this.totalMappedCount = validCount;

    if (validCount > 0) {
      this.map.fitBounds(bounds);
      const listener = google.maps.event.addListener(this.map, 'idle', () => {
        if (this.map.getZoom() > 13) this.map.setZoom(13);
        google.maps.event.removeListener(listener);
      });
    }

    this.cdr.markForCheck();
  }

  private openInfoWindowForPoint(r: MapPoint | any, marker: any): void {
    const resId = r.id || r._id || '';
    const typeLabel = r.type === 'LegalAid' ? 'Legal Aid Center' : r.type === 'Court' ? 'District Court' : r.type;
    const phone = Array.isArray(r.contactNumber) ? r.contactNumber[0] : (r.contactNumber || 'N/A');

    const contentString = `
      <div style="font-family: system-ui, sans-serif; min-width: 240px; max-width: 300px; padding: 4px; color: #1e293b;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
          <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: #e0e7ff; color: #4338ca;">
            ${typeLabel}
          </span>
          <span style="font-size: 9px; font-weight: 700; color: ${r.status === 'approved' ? '#059669' : '#d97706'};">
            ● ${r.status === 'approved' ? 'Verified' : 'Pending'}
          </span>
        </div>
        <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #0f172a; line-height: 1.3;">
          ${r.name}
        </h4>
        <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b; line-height: 1.4;">
          ${r.address || ((r.district || r.city || '') + ', ' + r.state)}
        </p>
        <div style="font-size: 11px; font-weight: 600; color: #334155; margin-bottom: 8px;">
          📞 ${phone}
        </div>
        <button onclick="window._adminInspectResourceById('${resId}')"
          style="width: 100%; padding: 6px 12px; background: #4f46e5; color: #ffffff; font-size: 11px; font-weight: 700; border: none; border-radius: 8px; cursor: pointer;">
          Inspect Full Dossier →
        </button>
      </div>
    `;

    this.infoWindow.setContent(contentString);
    this.infoWindow.open(this.map, marker);
  }

  private getTypeMarkerColor(type: string): string {
    switch (type) {
      case 'Court': return '#38bdf8'; // Sky Blue
      case 'LegalAid': return '#818cf8'; // Indigo
      case 'PoliceStation': return '#f59e0b'; // Amber
      case 'GovernmentOffice': return '#fb923c'; // Orange
      default: return '#10b981'; // Emerald
    }
  }

  private calculateCoverageGaps(): void {
    this.stateCounts = {};
    const dataset = this.allMapPoints.length > 0 ? this.allMapPoints : this.resources;
    dataset.forEach(r => {
      if (r.state) {
        this.stateCounts[r.state] = (this.stateCounts[r.state] || 0) + 1;
      }
    });

    this.gapStates = INDIAN_STATES.filter(st => (this.stateCounts[st] || 0) < 3);
    this.wellCoveredStates = INDIAN_STATES.filter(st => (this.stateCounts[st] || 0) >= 3);
    this.cdr.markForCheck();
  }
}