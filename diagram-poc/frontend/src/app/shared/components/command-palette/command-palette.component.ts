import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

/** A single runnable action shown in the command palette. */
export interface Command {
  label: string;
  icon?: string;
  hint?: string;
  run: () => void;
}

/**
 * Ctrl/Cmd+K command palette: fuzzy-filterable list of actions with keyboard
 * navigation. Presentation only — the parent supplies the commands.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './command-palette.component.html',
  styleUrls: ['./command-palette.component.css'],
})
export class CommandPaletteComponent implements AfterViewInit {
  @Input() commands: Command[] = [];
  @Output() close = new EventEmitter<void>();
  @ViewChild('search') searchRef!: ElementRef<HTMLInputElement>;

  query = '';
  selected = 0;

  get filtered(): Command[] {
    const q = this.query.trim().toLowerCase();
    return q ? this.commands.filter((c) => c.label.toLowerCase().includes(q)) : this.commands;
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.searchRef?.nativeElement.focus());
  }

  onInput(): void {
    this.selected = 0;
  }

  onKeydown(event: KeyboardEvent): void {
    const list = this.filtered;
    switch (event.key) {
      case 'ArrowDown':
        this.selected = Math.min(this.selected + 1, list.length - 1);
        event.preventDefault();
        break;
      case 'ArrowUp':
        this.selected = Math.max(this.selected - 1, 0);
        event.preventDefault();
        break;
      case 'Enter':
        this.run(list[this.selected]);
        event.preventDefault();
        break;
      case 'Escape':
        this.close.emit();
        break;
    }
  }

  run(cmd?: Command): void {
    if (!cmd) return;
    cmd.run();
    this.close.emit();
  }
}
