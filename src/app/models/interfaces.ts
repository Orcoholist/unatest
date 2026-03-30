export interface Article {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface Annotation {
  id: string;
  articleId: string;
  startOffset: number;
  endOffset: number;
  color: string;
  note: string;
  createdAt: Date;
}
