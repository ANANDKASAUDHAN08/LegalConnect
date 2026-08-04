import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'relativeTime',
  standalone: true
})
export class RelativeTimePipe implements PipeTransform {
  transform(value: Date | string | number | null | undefined): string {
    if (!value) return '';

    const date = new Date(value);
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (isNaN(date.getTime())) return '';

    if (elapsedSeconds < 30) {
      return 'Just now';
    }
    if (elapsedSeconds < 60) {
      return `${elapsedSeconds}s ago`;
    }

    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    if (days === 1) {
      return 'Yesterday';
    }
    if (days < 7) {
      return `${days}d ago`;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    if (year === now.getFullYear()) {
      return `${month} ${day}`;
    }

    return `${month} ${day}, ${year}`;
  }
}