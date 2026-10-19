/**
 * ResQLink PWA Manager
 * Coordinates Service Worker registration, Background Sync API hooks,
 * PWA installability prompts, and application-shell cache lifecycle.
 */

export interface PwaStatus {
  isServiceWorkerRegistered: boolean;
  isBackgroundSyncSupported: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  cacheReady: boolean;
}

type PwaListener = (status: PwaStatus) => void;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

class PwaManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isSwRegistered: boolean = false;
  private isInstalled: boolean = false;
  private listeners: Set<PwaListener> = new Set();

  constructor() {
    this.init();
  }

  public subscribe(listener: PwaListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  public getStatus(): PwaStatus {
    const isBackgroundSyncSupported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'SyncManager' in window;

    return {
      isServiceWorkerRegistered: this.isSwRegistered,
      isBackgroundSyncSupported,
      isInstallable: this.deferredPrompt !== null,
      isInstalled: this.isInstalled,
      cacheReady: typeof window !== 'undefined' && 'caches' in window,
    };
  }

  private notify(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('Error in PWA status listener:', err);
      }
    }
  }

  public init(): void {
    if (typeof window === 'undefined') return;

    // Detect if app is running as an installed PWA (standalone display)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    this.isInstalled = isStandalone;

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.notify();
    });

    // Detect installation completion
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isInstalled = true;
      this.notify();
    });

    // Register service worker in production / browser environment
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        this.registerServiceWorker();
      });
    }
  }

  public async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      this.isSwRegistered = true;
      this.notify();

      // Listen for background sync trigger messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'RESQLINK_BACKGROUND_SYNC') {
          import('../sync/sync-queue').then(({ syncQueueManager }) => {
            syncQueueManager.processQueue().catch((err) => {
              console.warn('[PWA] Background sync triggered processQueue error:', err);
            });
          });
        }
      });

      return registration;
    } catch (err) {
      console.warn('[PWA] Service Worker registration failed:', err);
      return null;
    }
  }

  /**
   * Registers a background sync tag with the Service Worker when supported.
   * Gracefully returns false if Background Sync is not supported by the browser.
   */
  public async requestBackgroundSync(tag: string = 'resqlink-sync'): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        // Chromium Background Sync API
        await (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PWA] Background Sync registration failed (falling back to foreground):', err);
      return false;
    }
  }

  /**
   * Triggers the PWA install prompt.
   * Returns true if user accepted the installation.
   */
  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.notify();
      return choice.outcome === 'accepted';
    } catch (err) {
      console.warn('[PWA] Install prompt error:', err);
      return false;
    }
  }
}

export const pwaManager = new PwaManager();
