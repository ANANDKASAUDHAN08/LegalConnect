import { Injectable } from '@angular/core';

export interface ResourceFilterState {
  search: string;
  selectedState: string;
  selectedDistrict: string;
  selectedType: string;
  selectedFacility: string;
  selectedJurisdiction: string;
  selectedStatus: string;
  startDate: string;
  endDate: string;
}

@Injectable({
  providedIn: 'root'
})
export class ResourceFiltersService {
  private defaultState: ResourceFilterState = {
    search: '',
    selectedState: '',
    selectedDistrict: '',
    selectedType: '',
    selectedFacility: '',
    selectedJurisdiction: '',
    selectedStatus: '',
    startDate: '',
    endDate: ''
  };

  createInitialState(): ResourceFilterState {
    return { ...this.defaultState };
  }

  isFilterActive(state: ResourceFilterState): boolean {
    return Boolean(
      state.search ||
      state.selectedState ||
      state.selectedDistrict ||
      state.selectedType ||
      state.selectedFacility ||
      state.selectedJurisdiction ||
      state.selectedStatus ||
      state.startDate ||
      state.endDate
    );
  }

  getActiveFilterCount(state: ResourceFilterState): number {
    let count = 0;
    if (state.selectedType) count++;
    if (state.selectedState) count++;
    if (state.selectedDistrict) count++;
    if (state.selectedFacility) count++;
    if (state.selectedJurisdiction) count++;
    if (state.selectedStatus) count++;
    if (state.startDate || state.endDate) count++;
    if (state.search) count++;
    return count;
  }

  buildQueryParams(state: ResourceFilterState, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc'): Record<string, any> {
    const params: Record<string, any> = { page, limit, sortBy, sortOrder };
    if (state.search) params['search'] = state.search.trim();
    if (state.selectedState && state.selectedState !== 'All') params['state'] = state.selectedState;
    if (state.selectedDistrict && state.selectedDistrict !== 'All') params['district'] = state.selectedDistrict;
    if (state.selectedType && state.selectedType !== 'All') params['type'] = state.selectedType;
    if (state.selectedFacility && state.selectedFacility !== 'All') params['facility'] = state.selectedFacility;
    if (state.selectedJurisdiction && state.selectedJurisdiction !== 'All') params['jurisdictionLevel'] = state.selectedJurisdiction;
    if (state.selectedStatus && state.selectedStatus !== 'All') params['status'] = state.selectedStatus;
    if (state.startDate) params['startDate'] = state.startDate;
    if (state.endDate) params['endDate'] = state.endDate;
    return params;
  }
}