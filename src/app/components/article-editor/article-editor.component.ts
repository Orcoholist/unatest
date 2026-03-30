import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Article } from '../../models/interfaces';
import { ArticleService } from '../../services/article.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TextAnnotatorComponent } from '../text-annotator/text-annotator.component';

@Component({
  selector: 'app-article-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TextAnnotatorComponent],
  templateUrl: './article-editor.component.html',
  styleUrls: ['./article-editor.component.css'],
})
export class ArticleEditorComponent implements OnInit {
  articleId: string | null = null;
  article: Article | null = null;
  articleTitle: string = '';
  articleContent: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private articleService: ArticleService,
  ) {}

  ngOnInit(): void {
    this.articleId = this.route.snapshot.paramMap.get('id');

    if (this.articleId) {
      this.loadArticle();
    }
  }

  loadArticle(): void {
    const loadedArticle = this.articleService.get(this.articleId!);
    this.article = loadedArticle || null;
    if (this.article) {
      this.articleTitle = this.article.title;
      this.articleContent = this.article.content;
    }
  }

  saveArticle(): void {
    if (!this.articleTitle.trim()) {
      alert('Введите заголовок статьи');
      return;
    }

    if (this.articleId) {
      this.articleService.update(this.articleId, {
        title: this.articleTitle,
        content: this.articleContent,
      });
    } else {
      this.articleService.create(this.articleTitle, this.articleContent);
    }

    this.router.navigate(['/']);
  }

  cancel(): void {
    this.router.navigate(['/']);
  }
}
