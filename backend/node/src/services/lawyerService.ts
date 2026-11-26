import Lawyer from '../models/Lawyer';
import PracticeAreaModel from '../models/PracticeArea';
import { getCache, setCache } from './statsService';
import { escapeRegex } from '../utils/escapeRegex';

export async function searchLawyers(params: {
  specialization?: string;
  city?: string;
  q?: string;
  practiceArea?: string;
}) {
  const filter: any = { isVerified: true };

  if (params.practiceArea) {
    const area = await PracticeAreaModel.findOne({
      id: params.practiceArea,
      isPublished: true
    }).lean();
    if (area) {
      const terms = [area.name, ...(area.aliases || [])];
      const escaped = terms.map(t => escapeRegex(t.trim())).filter(t => t.length > 0);
      if (escaped.length > 0) {
        filter.specializations = { $regex: new RegExp(escaped.join('|'), 'i') };
      }
    }
  } else if (params.specialization) {
    filter.specializations = { $regex: new RegExp(escapeRegex(params.specialization), 'i') };
  }

  if (params.city) {
    filter.city = { $regex: new RegExp(escapeRegex(params.city), 'i') };
  }

  if (params.q) {
    const qRegex = new RegExp(escapeRegex(params.q), 'i');
    filter.$or = [
      { name: { $regex: qRegex } },
      { specializations: { $regex: qRegex } },
      { city: { $regex: qRegex } },
      { bio: { $regex: qRegex } }
    ];
  }

  return await Lawyer.find(filter).sort({ rating: -1 });
}

export async function getLawyerMeta() {
  const cacheKey = 'legal:lawyers:meta';
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const cities = await Lawyer.distinct('city');
  const specializations = await Lawyer.distinct('specializations');
  const result = {
    cities: cities.sort(),
    specializations: specializations.sort()
  };

  await setCache(cacheKey, result, 600); // 10 minutes cache
  return result;
}

export async function getLawyersByIds(ids: string[]) {
  return await Lawyer.find({ _id: { $in: ids } });
}

export async function getLawyerById(id: string) {
  const cacheKey = `legal:lawyer:${id}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const lawyer = await Lawyer.findById(id);
  if (lawyer) {
    await setCache(cacheKey, lawyer, 600);
  }
  return lawyer;
}

export async function syncLawyerProfile(email: string, data: any) {
  const safeEmail = escapeRegex(email);
  return await Lawyer.findOneAndUpdate(
    { email: { $regex: new RegExp(`^${safeEmail}$`, 'i') } },
    {
      name: data.name,
      specializations: data.specializations,
      city: data.city,
      experience: Number(data.experience),
      bio: data.bio,
      phone: data.phone,
      email: data.email,
      rating: Number(data.rating || 4.5),
      isVerified: true,
      consultationFee: Number(data.consultationFee || 0),
      inPersonFee: Number(data.inPersonFee || 0),
      casesCompleted: Number(data.casesCompleted || 150),
      successRate: Number(data.successRate || 95),
      officeAddress: data.officeAddress || '',
      education: data.education || '',
      languagesSpoken: data.languagesSpoken || [],
      isAvailable: data.isAvailable !== false,
      avatarUrl: data.avatarUrl || '',
      bannerUrl: data.bannerUrl || '',
      activeCourts: data.activeCourts || [],
      responseTime: data.responseTime || 'Responds within 24 hours',
      workingHours: data.workingHours || { days: 'Mon - Fri', hours: '9:00 AM - 6:00 PM' },
      socialLinks: data.socialLinks || { linkedin: '', website: '', barAssociation: '' },
      faqs: data.faqs || [],
      accolades: data.accolades || [],
      casesList: data.casesList || [],
      availableTimeSlots: data.availableTimeSlots || []
    },
    { returnDocument: 'after', upsert: true }
  );
}

export async function deleteSyncedLawyer(email: string) {
  const safeEmail = escapeRegex(email);
  return await Lawyer.deleteOne({ email: { $regex: new RegExp(`^${safeEmail}$`, 'i') } });
}