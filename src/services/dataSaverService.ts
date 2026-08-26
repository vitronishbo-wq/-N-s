import { DataSaverSettings, OfflineQueuedEvent } from '../types';
import { db, doc, setDoc, serverTimestamp } from '../firebase/config';

const DATA_SAVER_STORAGE_KEY = 'enos_data_saver_settings_v1';
const OFFLINE_QUEUE_STORAGE_KEY = 'enos_offline_events_queue_v1';

export const DEFAULT_DATA_SAVER_SETTINGS: DataSaverSettings = {
  enabled: false,
  qualityLevel: 'balanced',
  autoDownloadAudio: false,
  loadThumbnailsOnly: false,
  offlineQueueSyncEnabled: true
};

/**
 * PONTO 4: Data-Saver & CPLP Resilient Mobile Infrastructure
 * Handles low-bandwidth data saving, progressive image degradation, and offline action queues.
 */
export class DataSaverService {
  private static instance: DataSaverService;
  private settings: DataSaverSettings;
  private queue: OfflineQueuedEvent[] = [];
  private isFlushing = false;

  private constructor() {
    this.settings = this.loadSettings();
    this.queue = this.loadQueue();
    this.setupNetworkListener();
  }

  public static getInstance(): DataSaverService {
    if (!DataSaverService.instance) {
      DataSaverService.instance = new DataSaverService();
    }
    return DataSaverService.instance;
  }

  private loadSettings(): DataSaverSettings {
    if (typeof window === 'undefined') return DEFAULT_DATA_SAVER_SETTINGS;
    try {
      const stored = localStorage.getItem(DATA_SAVER_STORAGE_KEY);
      return stored ? { ...DEFAULT_DATA_SAVER_SETTINGS, ...JSON.parse(stored) } : DEFAULT_DATA_SAVER_SETTINGS;
    } catch {
      return DEFAULT_DATA_SAVER_SETTINGS;
    }
  }

  private loadQueue(): OfflineQueuedEvent[] {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private persistSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(DATA_SAVER_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {}
  }

  private persistQueue(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch {}
  }

  private setupNetworkListener(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.flushQueue();
    });
  }

  public getSettings(): DataSaverSettings {
    return { ...this.settings };
  }

  public updateSettings(updates: Partial<DataSaverSettings>): DataSaverSettings {
    this.settings = { ...this.settings, ...updates };
    this.persistSettings();
    return this.getSettings();
  }

  public isDataSaverActive(): boolean {
    return this.settings.enabled;
  }

  /**
   * Transforms an image URL to low-bandwidth variant when data saver is active
   */
  public getOptimizedImageUrl(url: string, thumbnailVariant?: boolean): string {
    if (!url) return '';
    if (!this.settings.enabled && !thumbnailVariant) return url;

    // Unsplash parameter transformation for ultra-lightweight delivery
    if (url.includes('images.unsplash.com')) {
      const baseUrl = url.split('?')[0];
      if (this.settings.qualityLevel === 'ultra_low' || thumbnailVariant) {
        return `${baseUrl}?w=200&q=50&auto=format&fit=crop`;
      }
      return `${baseUrl}?w=450&q=65&auto=format&fit=crop`;
    }

    return url;
  }

  /**
   * Enqueues an action when offline or on unstable network
   */
  public enqueueOfflineAction(type: OfflineQueuedEvent['type'], payload: Record<string, unknown>): void {
    const event: OfflineQueuedEvent = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      enqueuedAt: Date.now(),
      retryCount: 0
    };

    this.queue.push(event);
    this.persistQueue();

    // Attempt immediate flush if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.flushQueue();
    }
  }

  /**
   * Flushes queued actions to Firestore when network is recovered
   */
  public async flushQueue(): Promise<number> {
    if (this.isFlushing || this.queue.length === 0) return 0;
    this.isFlushing = true;
    let flushedCount = 0;

    const remainingQueue: OfflineQueuedEvent[] = [];

    for (const item of this.queue) {
      try {
        if (item.type === 'telemetry' || item.type === 'outcome') {
          await setDoc(doc(db, 'offline_events', item.id), {
            ...item.payload,
            type: item.type,
            syncedAt: Date.now(),
            serverTimestamp: serverTimestamp()
          });
          flushedCount++;
        } else {
          flushedCount++;
        }
      } catch (err) {
        item.retryCount++;
        if (item.retryCount < 5) {
          remainingQueue.push(item);
        }
      }
    }

    this.queue = remainingQueue;
    this.persistQueue();
    this.isFlushing = false;
    return flushedCount;
  }

  public getPendingQueueSize(): number {
    return this.queue.length;
  }
}

export const dataSaver = DataSaverService.getInstance();
