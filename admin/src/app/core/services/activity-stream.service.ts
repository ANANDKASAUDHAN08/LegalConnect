import { Injectable, signal } from '@angular/core';

export interface ActivityEvent {
  id: string;
  type: 'lawyer_reg' | 'verification_req' | 'urgent_ticket' | 'security_alert';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ActivityStreamService {
  events = signal<ActivityEvent[]>([
    {
      id: 'act-1',
      type: 'verification_req',
      title: 'Bar Credential Verification Pending',
      message: 'Adv. Rajesh Kumar submitted Bar License (D/1429/2018) for verification.',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      read: false,
      link: '/lawyers'
    },
    {
      id: 'act-2',
      type: 'lawyer_reg',
      title: 'New Lawyer Profile Onboarded',
      message: 'Adv. Priya Sharma registered under High Court of Delhi.',
      timestamp: new Date(Date.now() - 25 * 60 * 1000),
      read: false,
      link: '/lawyers'
    },
    {
      id: 'act-3',
      type: 'urgent_ticket',
      title: 'Urgent Legal Aid Request',
      message: 'New support ticket #TK-802: Emergency bail assistance required.',
      timestamp: new Date(Date.now() - 65 * 60 * 1000),
      read: true,
      link: '/support'
    },
    {
      id: 'act-4',
      type: 'security_alert',
      title: 'IT Act Security Audit Warning',
      message: 'Multiple invalid admin login attempts detected from IP 192.168.1.105',
      timestamp: new Date(Date.now() - 180 * 60 * 1000),
      read: true,
      link: '/security'
    }
  ]);

  constructor() {
    this.startSimulatedRealTimeStream();
  }

  get unreadCount(): number {
    return this.events().filter(e => !e.read).length;
  }

  markAllAsRead(): void {
    this.events.update(list => list.map(e => ({ ...e, read: true })));
  }

  pushEvent(event: Omit<ActivityEvent, 'id' | 'timestamp' | 'read'>): void {
    const newEvent: ActivityEvent = {
      ...event,
      id: `act-${Date.now()}`,
      timestamp: new Date(),
      read: false
    };
    this.events.update(list => [newEvent, ...list]);
  }

  private startSimulatedRealTimeStream(): void {
    // Simulated real-time WebSocket / SSE telemetry stream
    setInterval(() => {
      const mockStreamEvents: Array<Omit<ActivityEvent, 'id' | 'timestamp' | 'read'>> = [
        {
          type: 'verification_req',
          title: 'Advocate Verification Queue',
          message: 'Adv. Vikram Seth submitted Bar Council credentials for audit.',
          link: '/lawyers'
        },
        {
          type: 'urgent_ticket',
          title: 'Support Desk Grievance',
          message: 'New grievance submission #TK-904 assigned to DPO queue.',
          link: '/support'
        },
        {
          type: 'lawyer_reg',
          title: 'Lawyer Directory Update',
          message: 'Adv. Ananya Roy updated consultation fee rates in Mumbai region.',
          link: '/lawyers'
        }
      ];

      const randomEvent = mockStreamEvents[Math.floor(Math.random() * mockStreamEvents.length)];
      this.pushEvent(randomEvent);
    }, 45000); // Push live activity event every 45s
  }
}