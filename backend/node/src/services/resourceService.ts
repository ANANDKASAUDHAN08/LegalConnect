import LegalResource from '../models/LegalResource';
import HelpHelpline from '../models/HelpHelpline';

export interface ResourceFilter {
  type?: string;
  city?: string;
  category?: string;
  status?: string;
}

export async function getResources(filter: ResourceFilter = {}) {
  const mongoFilter: any = {};
  if (filter.type) mongoFilter.type = filter.type;
  if (filter.city) mongoFilter.city = new RegExp(filter.city, 'i');
  if (filter.category) mongoFilter.categories = filter.category;
  if (filter.status) mongoFilter.status = filter.status;

  return await LegalResource.find(mongoFilter).sort({ createdAt: -1 }).lean();
}

export async function getHelpNearMe(category?: string, location?: string) {
  const filter: any = {};
  if (location) filter.city = new RegExp(location, 'i');
  if (category) filter.categories = category;

  const [resources, helplines] = await Promise.all([
    LegalResource.find(filter).lean(),
    HelpHelpline.find().lean()
  ]);

  return {
    resources,
    helplines,
    totalFound: resources.length + helplines.length
  };
}

export async function createResource(data: any) {
  const resource = new LegalResource(data);
  return await resource.save();
}

export async function updateResource(id: string, data: any) {
  return await LegalResource.findByIdAndUpdate(id, data, { new: true });
}

export async function deleteResource(id: string) {
  return await LegalResource.findByIdAndDelete(id);
}