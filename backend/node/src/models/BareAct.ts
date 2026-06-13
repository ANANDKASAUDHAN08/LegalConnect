import mongoose, { Document, Schema } from 'mongoose';

export interface ISection {
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
  chapters: IChapter[];
}

const SectionSchema = new Schema<ISection>({
  section_number: { type: String, required: true },
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
});

const ChapterSchema = new Schema<IChapter>({
  chapterNumber: { type: String, required: true },
  title: { type: String, required: true },
  sections: [SectionSchema]
});

const BareActSchema = new Schema<IBareAct>({
  actName: { type: String, required: true, unique: true },
  shortName: { type: String, required: true },
  year: { type: Number, required: true },
  description: { type: String },
  chapters: [ChapterSchema]
}, {
  timestamps: true
});

// Full-Text Search Index
BareActSchema.index({
  actName: 'text',
  description: 'text',
  'chapters.title': 'text',
  'chapters.sections.title': 'text',
  'chapters.sections.content': 'text'
}, {
  weights: {
    actName: 10,
    'chapters.title': 5,
    'chapters.sections.title': 5,
    description: 2,
    'chapters.sections.content': 1
  },
  name: "TextIndex"
});

export default mongoose.model<IBareAct>('BareAct', BareActSchema);
