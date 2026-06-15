import mongoose, { Document, Schema } from 'mongoose';

// --- Plain Types / Interfaces for Type Safety across Seeding and API layers ---
export interface ISectionOutline {
  section_number: string;
  title: string;
  title_hi?: string;
  clean_title?: string;
  clean_title_hi?: string;
  introduction_text?: string;
  introduction_text_hi?: string;
}

export interface IChapterOutline {
  chapterNumber: string;
  title: string;
  sections: ISectionOutline[];
}

export interface ISection {
  actShortName?: string;
  chapterNumber?: string;
  section_number: string;
  title: string;
  title_hi?: string;
  content: string;
  content_hi?: string;
  aiSummary?: string;
  clean_title?: string;
  clean_title_hi?: string;
  introduction_text?: string;
  introduction_text_hi?: string;
  content_blocks?: { type: string; text: string }[];
  content_blocks_hi?: { type: string; text: string }[];
}

export interface IChapter {
  chapterNumber: string;
  title: string;
  sections: ISection[];
}

export interface IBareAct extends Document {
  actName: string;
  shortName: string;
  year: number;
  description?: string;
  chapters: IChapterOutline[];
}

export interface ISectionDocument extends ISection, Document {}

// --- Mongoose Schemas ---
const SectionOutlineSchema = new Schema<ISectionOutline>({
  section_number: { type: String, required: true },
  title: { type: String, required: true },
  title_hi: { type: String },
  clean_title: { type: String },
  clean_title_hi: { type: String },
  introduction_text: { type: String },
  introduction_text_hi: { type: String }
});

const ChapterOutlineSchema = new Schema<IChapterOutline>({
  chapterNumber: { type: String, required: true },
  title: { type: String, required: true },
  sections: [SectionOutlineSchema]
});

const BareActSchema = new Schema<IBareAct>({
  actName: { type: String, required: true, unique: true },
  shortName: { type: String, required: true, unique: true, index: true },
  year: { type: Number, required: true },
  description: { type: String },
  chapters: [ChapterOutlineSchema]
}, {
  timestamps: true
});

const SectionSchema = new Schema<ISectionDocument>({
  actShortName: { type: String, required: true, index: true },
  chapterNumber: { type: String, required: true },
  section_number: { type: String, required: true, index: true },
  title: { type: String, required: true },
  title_hi: { type: String },
  content: { type: String, required: true },
  content_hi: { type: String },
  aiSummary: { type: String },
  clean_title: { type: String },
  clean_title_hi: { type: String },
  introduction_text: { type: String },
  introduction_text_hi: { type: String },
  content_blocks: [{
    type: { type: String },
    text: { type: String }
  }],
  content_blocks_hi: [{
    type: { type: String },
    text: { type: String }
  }]
}, {
  timestamps: true
});

// Compound index on Act + Section Number for rapid lookups
SectionSchema.index({ actShortName: 1, section_number: 1 });

// Full-Text Search Index on flat Section documents instead of parent acts
SectionSchema.index({
  title: 'text',
  content: 'text',
  title_hi: 'text',
  content_hi: 'text'
}, {
  weights: {
    title: 10,
    title_hi: 10,
    content: 2,
    content_hi: 2
  },
  name: "SectionTextIndex"
});

export const SectionModel = mongoose.model<ISectionDocument>('Section', SectionSchema);
export default mongoose.model<IBareAct>('BareAct', BareActSchema);