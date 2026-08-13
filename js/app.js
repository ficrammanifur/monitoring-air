/**
 * AquaSense - Dashboard Monitoring Air
 * Interaksi UI dan simulasi status
 * 
 * @version 1.0.0
 * @author Andi Rahman
 */

(() => {
  'use strict';

  // ============================================
  // DOM SELECTORS
  // ============================================
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const sidebar = $('#sidebar');
  const scrim = $('#scrim');
  const toast = $('#toast');

  // ============================================
  // TOAST NOTIFICATION
  // ============================================
  let toastTimer = null;

  /**
   * Menampilkan pesan notifikasi sementara
   * @param {string} message - Pesan yang akan ditampilkan
   */
  const showToast = (message) => {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('show');
    }, 2600);
  };

  // ============================================
  // SIDEBAR NAVIGATION
  // ============================================
  /**
   * Menutup sidebar (mobile)
   */
  const closeMenu = () => {
    sidebar?.classList.remove('open');
    scrim?.classList.remove('show');
  };

  /**
   * Membuka sidebar (mobile)
   */
  const openMenu = () => {
    sidebar?.classList.add('open');
    scrim?.classList.add('show');
  };

  // Event: Open sidebar (mobile)
  $('#open-menu')?.addEventListener('click', openMenu);

  // Event: Close sidebar (mobile)
  $('#close-menu')?.addEventListener('click', closeMenu);
  scrim?.addEventListener('click', closeMenu);

  // Event: Navigation items
  $$('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      // Update active state
      $$('.nav-item').forEach((nav) => nav.classList.remove('active'));
      item.classList.add('active');

      // Show feedback
      const section = item.dataset.section || 'Unknown';
      showToast(`📋 ${section} dipilih`);

      // Close sidebar on mobile
      closeMenu();
    });
  });

  // ============================================
  // TABS - Trend Period
  // ============================================
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      // Update active tab
      $$('.tab').forEach((btn) => btn.classList.remove('active'));
      tab.classList.add('active');

      // Show feedback
      const range = tab.dataset.range || 'Unknown';
      showToast(`📊 Tren diubah ke ${range}`);
    });
  });

  // ============================================
  // BUTTON INTERACTIONS
  // ============================================
  // Configure station
  $('#configure')?.addEventListener('click', () => {
    showToast('⚙️ Konfigurasi station siap dibuka pada integrasi perangkat.');
  });

  // View all alerts
  $('#view-alerts')?.addEventListener('click', () => {
    showToast('🔔 Menampilkan 2 alert aktif.');
  });

  // Refresh status
  $('#refresh-status')?.addEventListener('click', (event) => {
    const button = event.currentTarget;
    const originalText = button.textContent;

    button.textContent = 'Checking…';
    button.disabled = true;

    window.setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
      showToast('✅ Wi-Fi dan broker MQTT masih terhubung.');
    }, 800);
  });

  // ============================================
  // LIVE DATA - Auto Refresh
  // ============================================
  /**
   * Update indicator live data
   */
  const updateLiveIndicator = () => {
    $$('.live-pill').forEach((pill) => {
      pill.innerHTML = '<i></i> Live data · just now';
    });
  };

  // Update every 10 seconds
  window.setInterval(updateLiveIndicator, 10000);

  // ============================================
  // KEYBOARD ACCESSIBILITY
  // ============================================
  document.addEventListener('keydown', (event) => {
    // Close sidebar with Escape key
    if (event.key === 'Escape' && sidebar?.classList.contains('open')) {
      closeMenu();
    }
  });

  // ============================================
  // MQTT SIMULATION (untuk integrasi nyata)
  // ============================================
  /**
   * Simulasi koneksi MQTT
   * Implementasi nyata: ganti dengan MQTT client library
   */
  const mqttSimulation = {
    isConnected: true,

    connect() {
      console.log('🔌 MQTT: Menghubungkan ke broker...');
      this.isConnected = true;
      this.updateIndicator('online');
      showToast('📡 MQTT broker terhubung');
    },

    disconnect() {
      console.log('🔌 MQTT: Memutuskan koneksi...');
      this.isConnected = false;
      this.updateIndicator('offline');
      showToast('⚠️ MQTT broker terputus');
    },

    updateIndicator(status) {
      const mqttIndicator = document.querySelector('.connection.mqtt');
      if (!mqttIndicator) return;

      if (status === 'online') {
        mqttIndicator.classList.remove('offline');
        mqttIndicator.classList.add('online');
        mqttIndicator.style.borderColor = '#b9dced';
        mqttIndicator.style.background = '#f0f8fc';
        mqttIndicator.title = 'Broker MQTT terhubung';
      } else {
        mqttIndicator.classList.remove('online');
        mqttIndicator.classList.add('offline');
        mqttIndicator.style.borderColor = '#f5c6cb';
        mqttIndicator.style.background = '#fdf0f0';
        mqttIndicator.title = 'Broker MQTT terputus';
      }
    },

    /**
     * Subscribe ke topic MQTT
     * @param {string} topic - Nama topic
     */
    subscribe(topic) {
      console.log(`📡 MQTT: Subscribe ke topic "${topic}"`);
    },

    /**
     * Publish data ke MQTT
     * @param {string} topic - Nama topic
     * @param {object} payload - Data yang akan dipublish
     */
    publish(topic, payload) {
      console.log(`📤 MQTT: Publish ke "${topic}"`, payload);
    }
  };

  // Ekspos ke global untuk debugging
  window.mqtt = mqttSimulation;

  // ============================================
  // DATA SIMULATION (untuk demo)
  // ============================================
  /**
   * Generate data sensor acak
   * @returns {object} Data sensor
   */
  const generateSensorData = () => {
    const ph = (7.2 + Math.random() * 0.6).toFixed(2);
    const turbidity = (1.2 + Math.random() * 1.8).toFixed(1);
    const temperature = (25.5 + Math.random() * 2.5).toFixed(1);

    return { ph, turbidity, temperature };
  };

  /**
   * Update dashboard dengan data baru
   */
  const updateDashboardData = () => {
    const data = generateSensorData();

    // Update pH
    const phElement = document.querySelector('.trend-head strong em');
    if (phElement) {
      phElement.textContent = `+${(Math.random() * 0.05).toFixed(2)}%`;
    }

    // Update Turbidity
    const turbElement = document.querySelector('.trend-head strong small');
    if (turbElement) {
      turbElement.textContent = `${data.turbidity} NTU`;
    }

    // Update table (first row)
    const firstRow = document.querySelector('tbody tr:first-child');
    if (firstRow) {
      const cells = firstRow.querySelectorAll('td');
      if (cells.length >= 5) {
        const time = new Date();
        cells[0].textContent = time.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        });
        cells[1].textContent = data.ph;
        cells[2].innerHTML = `${data.turbidity} <span>NTU</span>`;
        cells[3].textContent = `${data.temperature}°C`;
        // Status tetap diisi manual
      }
    }

    console.log('📊 Data diperbarui:', data);
  };

  // Update data setiap 30 detik (untuk demo)
  // window.setInterval(updateDashboardData, 30000);

  // ============================================
  // INIT - Log startup
  // ============================================
  console.log('🌊 AquaSense Dashboard loaded successfully');
  console.log(`📅 ${new Date().toLocaleString('id-ID')}`);
  console.log('ℹ️ Ketik "mqtt" di console untuk mengakses simulasi MQTT');

  // Auto-connect MQTT simulation setelah 2 detik
  window.setTimeout(() => {
    mqttSimulation.connect();
  }, 2000);
})();
