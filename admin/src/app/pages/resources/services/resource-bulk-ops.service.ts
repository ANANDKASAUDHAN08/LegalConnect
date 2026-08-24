import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminApiService } from '../../../core/admin-api.service';

@Injectable({
  providedIn: 'root'
})
export class ResourceBulkOpsService {
  constructor(private api: AdminApiService) { }

  bulkVerifyCycle(ids: string[], notes?: string): Observable<any> {
    return this.api.bulkVerifyResourceCycles(ids, notes);
  }

  bulkUpdateStatus(ids: string[], status: string): Observable<any> {
    return this.api.bulkUpdateResourceStatus(ids, status);
  }

  bulkDelete(ids: string[]): Observable<any> {
    return this.api.bulkDeleteResources(ids);
  }
}