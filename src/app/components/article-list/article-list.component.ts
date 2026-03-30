import { Component, OnInit, Renderer2, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Annotation, Article } from '../../models/interfaces';
import { ArticleService } from '../../services/article.service';
import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AnnotationService } from '../../services/annotation.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-article-list',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './article-list.component.html',
  styleUrls: ['./article-list.component.css'],
})
export class ArticleListComponent implements OnInit {
  articles$: Observable<Article[]>;
  annotatedArticles$: Observable<
    Array<{ article: Article; annotatedContent: SafeHtml; annotations: Annotation[] }>
  >;

  // Добавляем недостающие свойства
  contentWithHighlights: string = '';
  selectedText: string | null = null;
  selectionStart: number | null = null;
  selectionEnd: number | null = null;
  selectedColor: string = '#ffff00';
  annotationNote: string = '';
  tooltipVisible: boolean = false;
  tooltipContent: string | null = null;
  tooltipPosition = { x: 0, y: 0 };

  constructor(
    private articleService: ArticleService,
    private annotationService: AnnotationService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private renderer: Renderer2,
    private el: ElementRef,
  ) {
    this.articles$ = this.articleService.articles$;
    this.annotatedArticles$ = this.getAnnotatedArticles();
  }

  private getAnnotatedArticles(): Observable<
    Array<{ article: Article; annotatedContent: SafeHtml; annotations: Annotation[] }>
  > {
    return combineLatest([this.articleService.articles$, this.annotationService.annotations$]).pipe(
      map(([articles, annotations]) => {
        return articles.map((article) => {
          // Фильтруем аннотации для текущей статьи
          const articleAnnotations = annotations.filter((a) => a.articleId === article.id);

          // Генерируем аннотированный контент
          let annotatedContent = article.content;

          if (articleAnnotations.length > 0) {
            // Сортировка аннотаций по позиции в тексте
            articleAnnotations.sort((a, b) => a.startOffset - b.startOffset);

            // Применяем аннотации в обратном порядке, чтобы смещения не изменились
            for (let i = articleAnnotations.length - 1; i >= 0; i--) {
              const annotation = articleAnnotations[i];

              // Экранируем HTML-контент для безопасности
              const before = annotatedContent.substring(0, annotation.startOffset);
              const annotated = annotatedContent.substring(
                annotation.startOffset,
                annotation.endOffset,
              );
              const after = annotatedContent.substring(annotation.endOffset);

              // Экранируем заметку для безопасности
              const escapedNote = this.escapeHtml(annotation.note);

              annotatedContent = `${before}<span class="highlighted" data-annotation-id="${annotation.id}" data-note="${escapedNote}" style="background-color: ${annotation.color};">${annotated}</span>${after}`;
            }
          }

          // Обрезаем до 100 символов
          const truncatedContent = this.truncateWithHtml(annotatedContent, 100);

          // Используем DomSanitizer для безопасного встраивания HTML
          const safeContent = this.sanitizer.bypassSecurityTrustHtml(truncatedContent);

          return { article, annotatedContent: safeContent, annotations: articleAnnotations };
        });
      }),
    );
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private truncateWithHtml(htmlString: string, maxLength: number): string {
    const div = document.createElement('div');
    div.innerHTML = htmlString;

    let textLength = 0;
    const resultNodes: Node[] = [];

    const traverse = (node: Node): boolean => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (textLength + text.length <= maxLength) {
          resultNodes.push(node.cloneNode());
          textLength += text.length;
        } else {
          const remaining = maxLength - textLength;
          if (remaining > 0) {
            const truncatedText = text.substring(0, remaining);
            resultNodes.push(document.createTextNode(truncatedText));
            textLength = maxLength;
          }
          return true; // остановить
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node.cloneNode(false) as Element;
        for (const child of Array.from(node.childNodes)) {
          if (traverse(child)) {
            break;
          }
          element.appendChild(child.cloneNode(true));
        }
        resultNodes.push(element);
      }

      return textLength >= maxLength;
    };

    for (const child of Array.from(div.childNodes)) {
      if (traverse(child)) {
        break;
      }
    }

    const resultDiv = document.createElement('div');
    resultNodes.forEach((node) => resultDiv.appendChild(node));

    let innerHTML = resultDiv.innerHTML;
    if (textLength >= maxLength) {
      innerHTML += '...';
    }

    return innerHTML;
  }

  ngOnInit(): void {}

  createNewArticle(): void {
    this.router.navigate(['/editor']);
  }

  editArticle(id: string): void {
    this.router.navigate(['/editor', id]);
  }

  deleteArticle(id: string): void {
    if (confirm('Вы уверены, что хотите удалить эту статью?')) {
      this.articleService.delete(id);
    }
  }

  // Методы для работы с выделением текста
  onMouseEnter(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Ищем элемент с data-note атрибутом, начиная с target и поднимаясь вверх по DOM
    let currentElement: HTMLElement | null = target;
    let highlightedElement: HTMLElement | null = null;

    while (currentElement && currentElement !== this.el.nativeElement) {
      if (currentElement.hasAttribute('data-note')) {
        highlightedElement = currentElement;
        break;
      }
      currentElement = currentElement.parentElement;
    }

    if (highlightedElement) {
      const note = highlightedElement.getAttribute('data-note');
      if (note) {
        // Декодируем HTML-сущности при отображении
        this.tooltipContent = this.decodeHtml(note);
        this.tooltipPosition = {
          x: event.pageX + 10,
          y: event.pageY - 30,
        };
        this.tooltipVisible = true;
      }
    }
  }

  private decodeHtml(html: string): string {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }

  onMouseLeave(event: MouseEvent): void {
    // Проверяем, уходит ли курсор за пределы элемента с подсветкой
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (!relatedTarget || !relatedTarget.closest('.highlighted')) {
      this.tooltipVisible = false;
      this.tooltipContent = null;
    }
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  saveAnnotation(): void {
    // Метод будет реализован в зависимости от требований
  }

  clearSelection(): void {
    this.selectedText = null;
  }
}
