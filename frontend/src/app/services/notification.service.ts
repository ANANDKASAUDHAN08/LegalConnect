import { Injectable, signal } from '@angular/core';
import { SnackbarService } from './snackbar.service';

export interface FollowedAct {
  shortName: string;
  actName: string;
  followedAt: Date;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private followedKey = 'lc_followed_acts';
  private followedActs: FollowedAct[] = [];
  
  followedCount = signal<number>(0);

  constructor(private snackbar: SnackbarService) {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const data = localStorage.getItem(this.followedKey);
    if (data) {
      this.followedActs = JSON.parse(data);
      this.followedCount.set(this.followedActs.length);
    }
  }

  private saveToStorage() {
    localStorage.setItem(this.followedKey, JSON.stringify(this.followedActs));
    this.followedCount.set(this.followedActs.length);
  }

  getFollowedActs(): FollowedAct[] {
    return [...this.followedActs].sort((a, b) => 
      new Date(b.followedAt).getTime() - new Date(a.followedAt).getTime()
    );
  }

  isFollowing(shortName: string): boolean {
    return this.followedActs.some(a => a.shortName === shortName);
  }

  toggleFollow(shortName: string, actName: string) {
    const index = this.followedActs.findIndex(a => a.shortName === shortName);
    if (index > -1) {
      this.followedActs.splice(index, 1);
      this.snackbar.show(`Unfollowed ${shortName}.`, 'info');
    } else {
      this.followedActs.push({
        shortName,
        actName,
        followedAt: new Date()
      });
      this.snackbar.show(`Following ${shortName} for amendment alerts!`, 'success');
    }
    this.saveToStorage();
  }

  clearAll() {
    this.followedActs = [];
    this.saveToStorage();
    this.snackbar.show('All alerts cleared.', 'info');
  }
}
