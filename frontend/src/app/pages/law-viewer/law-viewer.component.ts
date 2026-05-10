import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { LegalService, BareAct, Chapter } from '../../services/legal.service';

@Component({
  selector: 'app-law-viewer',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf],
  templateUrl: './law-viewer.component.html',
  styleUrls: ['./law-viewer.component.scss']
})
export class LawViewerComponent implements OnInit {
  act: BareAct | null = null;
  activeChapter: Chapter | null = null;
  loading = true;
  error = '';

  constructor(private route: ActivatedRoute, private legalService: LegalService) {}

  ngOnInit() {
    const shortName = this.route.snapshot.paramMap.get('shortName') || '';
    this.legalService.getActByShortName(shortName).subscribe({
      next: res => {
        this.act = res.data;
        this.activeChapter = res.data.chapters[0] || null;
        this.loading = false;
      },
      error: () => { this.error = 'Could not load this act.'; this.loading = false; }
    });
  }

  setChapter(ch: Chapter) { this.activeChapter = ch; }
}
