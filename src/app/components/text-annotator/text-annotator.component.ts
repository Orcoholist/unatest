import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit,
  HostListener,
} from '@angular/core';
import { AnnotationService } from '../../services/annotation.service';
import { Annotation } from '../../models/interfaces';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-text-annotator',
  imports: [CommonModule, FormsModule],
  templateUrl: './text-annotator.component.html',
  styleUrls: ['./text-annotator.component.css'],
})
export class TextAnnotatorComponent implements AfterViewInit {
  @Input() articleId!: string;
  @Input() content: string = '';
  @Output() annotationsChanged = new EventEmitter<void>();

  @ViewChild('textContainer', { static: true }) textContainer!: ElementRef<HTMLDivElement>;

  selectedText: string | null = null;
  selectionStart: number | null = null;
  selectionEnd: number | null = null;
  selectedColor: string = '#ffff00';
  annotationNote: string = '';

  tooltipVisible: boolean = false;
  tooltipContent: string | null = null;
  tooltipPosition = { x: 0, y: 0 };

  contentWithHighlights: SafeHtml = ''; // Изменили тип на SafeHtml

  constructor(
    private annotationService: AnnotationService,
    private sanitizer: DomSanitizer, // Добавили инъекцию sanitizer
  ) {}

  ngAfterViewInit(): void {
    this.loadAnnotations();
  }

  async loadAnnotations(): Promise<void> {
    const annotations = await firstValueFrom(this.annotationService.getByArticleId(this.articleId));

 
    if (annotations && annotations.length > 0) {
      annotations.sort((a, b) => b.startOffset - a.startOffset);

      let result = this.escapeHtml(this.content);

      for (const annotation of annotations) {
        result = this.insertHighlight(result, annotation);
      }

      this.contentWithHighlights = this.sanitizer.bypassSecurityTrustHtml(result);
    } else {
      this.contentWithHighlights = this.sanitizer.bypassSecurityTrustHtml(
        this.escapeHtml(this.content),
      );
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  insertHighlight(content: string, annotation: Annotation): string {
    const before = content.substring(0, annotation.startOffset);
    const highlighted = content.substring(annotation.startOffset, annotation.endOffset);
    const after = content.substring(annotation.endOffset);


    const escapedHighlighted = this.escapeHtml(highlighted);
    const escapedNote = this.escapeHtml(annotation.note);

    return `${before}<span class="highlighted" data-annotation-id="${annotation.id}" data-note="${escapedNote}" style="background-color: ${annotation.color};">${escapedHighlighted}</span>${after}`;
  }

  onTextSelection(): void {
    const selection = window.getSelection();

    if (!selection || selection.toString().trim() === '') {
      this.selectedText = null;
      this.selectionStart = null;
      this.selectionEnd = null;
      return;
    }

    const selectedText = selection.toString();

    // Проверяем, находится ли выделение внутри нашего контейнера
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (!range || !this.textContainer.nativeElement.contains(range.commonAncestorContainer)) {
      return;
    }

    // Получаем оригинальный текст статьи для вычисления смещений
    const originalText = this.content;

    // Преобразуем range в смещения относительно оригинального текста
    const { startOffset, endOffset } = this.calculateOffsets(range, originalText);

    if (startOffset !== null && endOffset !== null) {
      this.selectionStart = startOffset;
      this.selectionEnd = endOffset;
      this.selectedText = selectedText;
    }
  }

  private calculateOffsets(
    range: Range,
    originalText: string,
  ): { startOffset: number | null; endOffset: number | null } {
    // Для простого текста без HTML-тегов можно использовать следующий подход:
    const container = this.textContainer.nativeElement;

    // Получаем текст до начала выделения
    const rangeToStart = document.createRange();
    rangeToStart.setStart(container, 0);
    rangeToStart.setEnd(range.startContainer, range.startOffset);
    const textBeforeSelection = rangeToStart.toString();

    // Получаем весь текст до конца выделения
    const rangeToEnd = document.createRange();
    rangeToEnd.setStart(container, 0);
    rangeToEnd.setEnd(range.endContainer, range.endOffset);
    const textBeforeAndDuringSelection = rangeToEnd.toString();

    // Определяем приблизительные смещения
    // Это приближенные значения, так как innerText может отличаться от оригинального текста
    let startOffset = textBeforeSelection.length;
    let endOffset = textBeforeAndDuringSelection.length;

    // Корректируем смещения, если возможно, на основе оригинального текста
    if (originalText && originalText.length > 0) {
      // Пытаемся найти наиболее близкие соответствия в оригинальном тексте
      const searchText = originalText.toLowerCase();
      const selectedTextLower = this.selectedText?.toLowerCase() || '';

      if (selectedTextLower) {
        const startIndex = searchText.indexOf(selectedTextLower, Math.max(0, startOffset - 50)); // ищем в окрестности
        if (startIndex !== -1) {
          startOffset = startIndex;
          endOffset = startIndex + selectedTextLower.length;
        }
      }
    }

    return { startOffset, endOffset };
  }

  /**
   * Рассчитывает абсолютную позицию в текстовом содержимом контейнера
   */
  private getTextPosition(node: Node, offset: number, containerText: string): number | null {
    // Получаем текст до указанной позиции
    const range = document.createRange();

    try {
      if (node.nodeType === Node.TEXT_NODE) {
        range.setStart(
          containerText.length > 0
            ? (this.textContainer.nativeElement.firstChild as Node) || node.parentNode || node
            : node,
          0,
        );
        range.setEnd(node, offset);
      } else {
        range.selectNodeContents(node);
        range.setEnd(node, offset);
      }

      // Для более точного определения позиции в тексте
      const rangeText = range.toString();
      return rangeText.length;
    } catch (e) {
      // В случае ошибки возвращаем длину текста в контейнере
      return containerText.length;
    }
  }

  async saveAnnotation(): Promise<void> {
    if (!this.selectedText || this.selectionStart === null || this.selectionEnd === null) {
      alert('Сначала выделите текст');
      return;
    }

    if (!this.annotationNote.trim()) {
      alert('Введите примечание к аннотации');
      return;
    }

    // Проверяем, пересекается ли новая аннотация с существующими
    const existingAnnotations = await firstValueFrom(
      this.annotationService.getByArticleId(this.articleId),
    );
    const overlappingAnnotation = existingAnnotations.find(
      (ann) =>
        (this.selectionStart! >= ann.startOffset && this.selectionStart! < ann.endOffset) ||
        (this.selectionEnd! > ann.startOffset && this.selectionEnd! <= ann.endOffset) ||
        (this.selectionStart! <= ann.startOffset && this.selectionEnd! >= ann.endOffset),
    );

    if (overlappingAnnotation) {
      alert('Выбранный текст уже аннотирован. Удалите старую аннотацию или выберите другой текст.');
      return;
    }

    const annotation = await this.annotationService.create({
      articleId: this.articleId,
      startOffset: this.selectionStart,
      endOffset: this.selectionEnd,
      color: this.selectedColor,
      note: this.annotationNote,
    });

    // Перезагружаем содержимое с новой аннотацией
    await this.loadAnnotations();
    this.clearSelection();
    this.annotationsChanged.emit();
  }

  clearSelection(): void {
    this.selectedText = null;
    this.selectionStart = null;
    this.selectionEnd = null;
    this.annotationNote = '';
  }

  onMouseEnter(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Ищем элемент с data-note атрибутом, а не только классом highlighted
    let currentElement: HTMLElement | null = target;
    let highlightedElement: HTMLElement | null = null;

    while (currentElement && currentElement !== this.textContainer.nativeElement) {

      if (
        currentElement.hasAttribute('data-note') &&
        (currentElement.classList.contains('highlighted') || currentElement.tagName === 'SPAN')
      ) {
        highlightedElement = currentElement;
        break;
      }

      currentElement = currentElement.parentElement;
    }

    if (highlightedElement) {
      const noteFromAttribute = highlightedElement.getAttribute('data-note');

      if (noteFromAttribute && noteFromAttribute.trim() !== '') {
        this.tooltipContent = this.decodeHtml(noteFromAttribute);
        this.tooltipPosition = {
          x: event.pageX + 10,
          y: event.pageY - 30,
        };
        this.tooltipVisible = true;
      } else {
        this.tooltipVisible = false;
        this.tooltipContent = null;
      }
    } else {
      this.tooltipVisible = false;
      this.tooltipContent = null;
    }
  }

  private decodeHtml(html: string): string {

    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }

  onMouseLeave(): void {
    this.tooltipVisible = false;
    this.tooltipContent = null;
  }

  /**
   * Обработчик события mouseup для всего документа
   */
  @HostListener('document:mouseup', ['$event'])
  onDocumentMouseUp(event: MouseEvent): void {
    // Проверяем, был ли клик внутри нашего контейнера
    if (this.textContainer.nativeElement.contains(event.target as Node)) {
      this.onTextSelection();
    }
  }

  /**
   * Обработчик события click для всего документа
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as Node;
    const annotationControls = document.querySelector('.annotation-controls');

    // Проверяем, является ли целевой элемент частью компонента
    const isInsideComponent =
      this.textContainer.nativeElement.contains(target) ||
      (annotationControls && annotationControls.contains(target));

    // Если клик был вне компонента, сбрасываем выделение
    if (!isInsideComponent) {
      if (this.selectedText) {
        this.clearSelection();
      }
    }
  }

  /**
   * Предотвращает всплытие события click из controls
   */
  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
