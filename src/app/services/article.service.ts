import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Article } from '../models/interfaces';

@Injectable({
  providedIn: 'root',
})
export class ArticleService {
  private readonly STORAGE_KEY = 'articles';

  private articlesSubject = new BehaviorSubject<Article[]>([]);
  public articles$ = this.articlesSubject.asObservable();

  constructor() {
    this.loadArticles();
  }

  private loadArticles(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      const articles = parsed.map((article: any) => ({
        ...article,
        createdAt: new Date(article.createdAt),
        updatedAt: new Date(article.updatedAt),
      }));
      this.articlesSubject.next(articles);
    }
  }

  private saveArticles(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.articlesSubject.value));
  }

  getAll(): Observable<Article[]> {
    return this.articles$;
  }

  get(id: string): Article | undefined {
    return this.articlesSubject.value.find((a) => a.id === id);
  }

  create(title: string, content: string): Article {
    const newArticle: Article = {
      id: this.generateId(),
      title,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedArticles = [...this.articlesSubject.value, newArticle];
    this.articlesSubject.next(updatedArticles);
    this.saveArticles();

    return newArticle;
  }

  update(id: string, updates: Partial<Article>): Article | null {
    const articles = this.articlesSubject.value;
    const index = articles.findIndex((a) => a.id === id);

    if (index === -1) return null;

    const article = { ...articles[index], ...updates, updatedAt: new Date() };
    articles[index] = article;

    this.articlesSubject.next([...articles]);
    this.saveArticles();

    return article;
  }

  delete(id: string): boolean {
    const updatedArticles = this.articlesSubject.value.filter((a) => a.id !== id);
    if (updatedArticles.length === this.articlesSubject.value.length) {
      return false;
    }

    this.articlesSubject.next(updatedArticles);
    this.saveArticles();
    return true;
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }
}
