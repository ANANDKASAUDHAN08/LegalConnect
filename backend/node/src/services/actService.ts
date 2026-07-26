import HelpCategory from '../models/HelpCategory';
import LegalResource from '../models/LegalResource';
import HelpHelpline from '../models/HelpHelpline';
import BareAct, { SectionModel } from '../models/BareAct';
import { getCache, setCache } from './statsService';

export async function getHelpCategories() {
  const cacheKey = 'legal:help:categories:v3';
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const rawCategories = await HelpCategory.find().lean();

  const result = await Promise.all(rawCategories.map(async (cat: any) => {
    const resourceCount = await LegalResource.countDocuments({
      categories: cat.id
    });

    return {
      ...cat,
      resourceCount
    };
  }));

  await setCache(cacheKey, result, 600);
  return result;
}

export async function getHelplines() {
  const cacheKey = 'legal:info:helplines';
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const helplines = await HelpHelpline.find().lean();
  await setCache(cacheKey, helplines, 600);
  return helplines;
}

export async function getBareActs() {
  const cacheKey = 'legal:laws:all';
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const acts = await BareAct.find().sort({ title: 1 }).lean();
  await setCache(cacheKey, acts, 3600);
  return acts;
}

export async function getBareActByShortName(shortName: string) {
  const cleanShortName = shortName.toUpperCase();
  const cacheKey = `legal:laws:act:${cleanShortName}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const act = await BareAct.findOne({ shortName: new RegExp(`^${shortName}$`, 'i') }).lean();
  if (act) {
    await setCache(cacheKey, act, 3600);
  }
  return act;
}

export async function getSectionByNumber(actShortName: string, sectionNumber: string) {
  const cleanShortName = actShortName.toUpperCase();
  const cacheKey = `legal:laws:sec:${cleanShortName}:${sectionNumber}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const section = await SectionModel.findOne({
    actShortName: new RegExp(`^${actShortName}$`, 'i'),
    section_number: new RegExp(`^${sectionNumber}$`, 'i')
  }).lean();

  if (section) {
    await setCache(cacheKey, section, 3600);
  }
  return section;
}

export async function searchSections(query: string, actShortName?: string) {
  const filter: any = {};
  if (actShortName) filter.actShortName = new RegExp(`^${actShortName}$`, 'i');
  if (query) {
    filter.$or = [
      { title: new RegExp(query, 'i') },
      { clean_title: new RegExp(query, 'i') },
      { section_number: new RegExp(query, 'i') },
      { content: new RegExp(query, 'i') }
    ];
  }
  return await SectionModel.find(filter).limit(50).lean();
}