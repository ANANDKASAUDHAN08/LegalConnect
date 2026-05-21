import mongoose, { Document, Schema } from 'mongoose';

export interface ISection {
  section_number: string;
  title: string;
  content: string;
  aiSummary?: string;
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
  content: { type: String, required: true },
  aiSummary: { type: String }
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
