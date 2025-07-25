// PWA Service Worker Registration and Utilities

class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.isOnline = navigator.onLine;
    this.registration = null;
    this.init();
  }

  async init() {
    // Register service worker
    await this.registerServiceWorker();
    
    // Setup install prompt handling
    this.setupInstallPrompt();
    
    // Setup online/offline detection
    this.setupNetworkDetection();
    
    // Setup update checking
    this.setupUpdateChecking();
    
    // Check if already installed
    this.checkInstallStatus();
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        console.log('PWA: Service Worker registered successfully', this.registration);
        
        // Handle updates
        this.registration.addEventListener('updatefound', () => {
          console.log('PWA: New service worker found');
          this.handleServiceWorkerUpdate();
        });
        
      } catch (error) {
        console.error('PWA: Service Worker registration failed', error);
      }
    } else {
      console.warn('PWA: Service Workers not supported');
    }
  }

  setupInstallPrompt() {
    // Listen for the install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('PWA: Install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA: App installed successfully');
      this.isInstalled = true;
      this.hideInstallButton();
      this.showToast('App installed successfully! You can now use it offline.', 'success');
    });
  }

  setupNetworkDetection() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('PWA: Back online');
      this.isOnline = true;
      this.showToast('Back online! Your changes will be synced.', 'success');
      this.syncPendingChanges();
    });

    window.addEventListener('offline', () => {
      console.log('PWA: Gone offline');
      this.isOnline = false;
      this.showToast('You are offline. Your work will be saved locally.', 'warning');
    });
  }

  setupUpdateChecking() {
    // Check for updates periodically
    setInterval(() => {
      if (this.registration) {
        this.registration.update();
      }
    }, 60000); // Check every minute
  }

  checkInstallStatus() {
    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone ||
        document.referrer.includes('android-app://')) {
      this.isInstalled = true;
      console.log('PWA: Running as installed app');
    }
  }

  async promptInstall() {
    if (!this.deferredPrompt) {
      this.showToast('Install not available. Try adding to home screen manually.', 'warning');
      return false;
    }

    try {
      // Show the install prompt
      this.deferredPrompt.prompt();
      
      // Wait for the user's response
      const result = await this.deferredPrompt.userChoice;
      
      if (result.outcome === 'accepted') {
        console.log('PWA: User accepted the install prompt');
        this.showToast('Installing app...', 'info');
      } else {
        console.log('PWA: User dismissed the install prompt');
      }
      
      // Clear the prompt
      this.deferredPrompt = null;
      this.hideInstallButton();
      
      return result.outcome === 'accepted';
    } catch (error) {
      console.error('PWA: Error showing install prompt', error);
      return false;
    }
  }

  handleServiceWorkerUpdate() {
    if (this.registration && this.registration.waiting) {
      // New service worker available
      this.showUpdatePrompt();
    }
  }

  showInstallButton() {
    // Create or show install button
    let installBtn = document.getElementById('pwa-install-btn');
    
    if (!installBtn) {
      installBtn = document.createElement('button');
      installBtn.id = 'pwa-install-btn';
      installBtn.className = 'btn secondary pwa-install-btn';
      installBtn.innerHTML = '📱 Install App';
      installBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 10000;
        background: linear-gradient(135deg, #0066cc, #0078ff);
        border: 1px solid #0066cc;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,102,204,0.3);
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
      `;
      
      installBtn.addEventListener('mouseenter', () => {
        installBtn.style.transform = 'translateY(-2px)';
        installBtn.style.boxShadow = '0 6px 20px rgba(0,102,204,0.4)';
      });
      
      installBtn.addEventListener('mouseleave', () => {
        installBtn.style.transform = 'translateY(0)';
        installBtn.style.boxShadow = '0 4px 12px rgba(0,102,204,0.3)';
      });
      
      installBtn.addEventListener('click', () => {
        this.promptInstall();
      });
      
      document.body.appendChild(installBtn);
    }
    
    installBtn.style.display = 'block';
  }

  hideInstallButton() {
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.style.display = 'none';
    }
  }

  showUpdatePrompt() {
    const updateBtn = document.createElement('button');
    updateBtn.className = 'btn secondary pwa-update-btn';
    updateBtn.innerHTML = '🔄 Update Available';
    updateBtn.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      z-index: 10000;
      background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
      border: 1px solid #ff6b6b;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(255,107,107,0.3);
      animation: pulse 2s infinite;
    `;
    
    updateBtn.addEventListener('click', () => {
      this.applyUpdate();
      document.body.removeChild(updateBtn);
    });
    
    document.body.appendChild(updateBtn);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (document.body.contains(updateBtn)) {
        document.body.removeChild(updateBtn);
      }
    }, 10000);
  }

  applyUpdate() {
    if (this.registration && this.registration.waiting) {
      // Tell the waiting service worker to become active
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload the page to use the new service worker
      window.location.reload();
    }
  }

  async syncPendingChanges() {
    if (!this.isOnline) return;
    
    try {
      // Trigger background sync if supported
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('background-save');
        console.log('PWA: Background sync registered');
      }
    } catch (error) {
      console.error('PWA: Error registering background sync', error);
    }
  }

  showToast(message, type = 'info') {
    // Use existing toast system if available, otherwise create simple notification
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`PWA ${type.toUpperCase()}: ${message}`);
    }
  }

  // Utility methods for other parts of the app
  isOnlineStatus() {
    return this.isOnline;
  }

  isInstalledStatus() {
    return this.isInstalled;
  }

  // Save data to cache for offline use
  async saveToCache(key, data) {
    try {
      if ('caches' in window) {
        const cache = await caches.open('excalidraw-data-v1');
        const response = new Response(JSON.stringify(data));
        await cache.put(key, response);
        console.log('PWA: Data cached successfully', key);
      }
    } catch (error) {
      console.error('PWA: Error caching data', error);
    }
  }

  // Load data from cache
  async loadFromCache(key) {
    try {
      if ('caches' in window) {
        const cache = await caches.open('excalidraw-data-v1');
        const response = await cache.match(key);
        if (response) {
          const data = await response.json();
          console.log('PWA: Data loaded from cache', key);
          return data;
        }
      }
    } catch (error) {
      console.error('PWA: Error loading data from cache', error);
    }
    return null;
  }
}

// Create global PWA manager instance
window.pwaManager = new PWAManager();

// Export for use in other modules
export default PWAManager;
