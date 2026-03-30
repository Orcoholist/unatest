import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Annotation } from '../models/interfaces';

@Injectable({
  providedIn: 'root',
})
export class AnnotationService {
  private readonly STORAGE_KEY = 'annotations';

  private annotationsSubject = new BehaviorSubject<Annotation[]>([]);
  public annotations$ = this.annotationsSubject.asObservable();

  constructor() {
    this.loadAnnotations();
  }

  private loadAnnotations(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      const annotations = parsed.map((annotation: any) => ({
        ...annotation,
        createdAt: new Date(annotation.createdAt),
      }));
      this.annotationsSubject.next(annotations);
    }
  }

  private saveAnnotations(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.annotationsSubject.value));
    // Уведомляем подписчиков об изменении данных
    this.annotationsSubject.next([...this.annotationsSubject.value]);
  }

  getByArticleId(articleId: string): Observable<Annotation[]> {
    const filtered = this.annotationsSubject.value.filter((a) => a.articleId === articleId);
    return of(filtered); // Используем of() для создания Observable с текущими данными
  }

  create(annotation: Omit<Annotation, 'id' | 'createdAt'>): Annotation {
    const newAnnotation: Annotation = {
      id: this.generateId(),
      ...annotation,
      createdAt: new Date(),
    };

    const updatedAnnotations = [...this.annotationsSubject.value, newAnnotation];
    this.annotationsSubject.next(updatedAnnotations);
    this.saveAnnotations();

    return newAnnotation;
  }

  update(id: string, updates: Partial<Annotation>): Annotation | null {
    const annotations = this.annotationsSubject.value;
    const index = annotations.findIndex((a) => a.id === id);

    if (index === -1) return null;

    const annotation = { ...annotations[index], ...updates };
    annotations[index] = annotation;

    this.annotationsSubject.next([...annotations]);
    this.saveAnnotations();

    return annotation;
  }

  delete(id: string): boolean {
    const updatedAnnotations = this.annotationsSubject.value.filter((a) => a.id !== id);
    if (updatedAnnotations.length === this.annotationsSubject.value.length) {
      return false; // Annotation not found
    }

    this.annotationsSubject.next(updatedAnnotations);
    this.saveAnnotations();
    return true;
  }

  clearByArticleId(articleId: string): void {
    const updatedAnnotations = this.annotationsSubject.value.filter(
      (a) => a.articleId !== articleId,
    );
    this.annotationsSubject.next(updatedAnnotations);
    this.saveAnnotations();
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }
}
