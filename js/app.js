/**
 * AquaSense - Dashboard Monitoring Air
 * Terintegrasi dengan MQTT Topics:
 * - ulum/ph
 * - ulum/turb
 * - ulum/status
 * 
 * @version 2.0.0
 * @author ulum
 */

(() => {
  'use strict';

  // ============================================
  // KONFIGURASI MQTT
  // ============================================
  const MQTT_CONFIG = {
    broker: 'broker.hivemq.com',
    port: 1883,
    clientId: 'aquasense-dashboard-' + Math.random().toString(16).substr(2, 8),
    topics: {
      ph: 'ulum/ph',
      turbidity: 'ulum/turb',
      status: 'ulum/status'
    }
  };

  // ============================================
  // DOM SELECTORS
  // ============================================
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const sidebar = $('#sidebar');
  const scrim = $('#scrim');
  const toast = $('#toast');
  const statusIndicator = $('#status-indicator');

  // ============================================
  // STATE
  // ============================================
  const state = {
    ph: 7.0,
    turbidity: 0,
    turbidityPercent: 100,
    turbStatus: 'JERNIH',
    temperature: 25.0,
    isOnline: false,
    lastUpdate: null,
    rssi: 0,
    ip: '--'
  };

  // ============================================
  // TOAST NOTIFICATION
  // ============================================
  let toastTimer = null;

  const showToast = (message, type = 'info') => {
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'show';
    
    // Tambahkan class untuk tipe notifikasi
    if (type === 'success') toast.classList.add('success');
    if (type === 'error') toast.classList.add('error');
    if (type === 'warning') toast.classList.add('warning');

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.className = '';
    }, 3000);
  };

  // ============================================
  // SIDEBAR NAVIGATION
  // ============================================
  const closeMenu = () => {
    sidebar?.classList.remove('open');
    scrim?.classList.remove('show');
  };

  const openMenu = () => {
    sidebar?.classList.add('open');
    scrim?.classList.add('show');
  };

  $('#open-menu')?.addEventListener('click', openMenu);
  $('#close-menu')?.addEventListener('click', closeMenu);
  scrim?.addEventListener('click', closeMenu);

  $$('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      $$('.nav-item').forEach((nav) => nav.classList.remove('active'));
      item.classList.add('active');
      const section = item.dataset.section || 'Unknown';
      showToast(`📋 ${section} dipilih`);
      closeMenu();
    });
  });

  // ============================================
  // TABS - Trend Period
  // ============================================
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach((btn) => btn.classList.remove('active'));
      tab.classList.add('active');
      const range = tab.dataset.range || 'Unknown';
      showToast(`📊 Tren diubah ke ${range}`);
    });
  });

  // ============================================
  // BUTTON INTERACTIONS
  // ============================================
  $('#configure')?.addEventListener('click', () => {
    showToast('⚙️ Konfigurasi station siap dibuka pada integrasi perangkat.');
  });

  $('#view-alerts')?.addEventListener('click', () => {
    showToast('🔔 Menampilkan 2 alert aktif.');
  });

  $('#refresh-status')?.addEventListener('click', (event) => {
    const button = event.currentTarget;
    const originalText = button.textContent;

    button.textContent = 'Checking…';
    button.disabled = true;

    window.setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
      
      // Cek status MQTT
      if (mqttClient.isConnected) {
        showToast('✅ Wi-Fi dan broker MQTT masih terhubung.', 'success');
      } else {
        showToast('⚠️ MQTT broker terputus, mencoba reconnect...', 'warning');
        mqttClient.connect();
      }
    }, 800);
  });

  // ============================================
  // MQTT CLIENT - Integrasi Nyata
  // ============================================
  const mqttClient = {
    isConnected: false,
    client: null,

    /**
     * Inisialisasi dan koneksi ke MQTT broker
     */
    connect() {
      // Cek apakah library Paho tersedia
      if (typeof Paho === 'undefined') {
        console.warn('⚠️ Paho MQTT library tidak ditemukan. Gunakan mode simulasi.');
        this.simulateConnection();
        return;
      }

      try {
        console.log('🔌 MQTT: Menghubungkan ke broker...');
        showToast('📡 Menghubungkan ke MQTT broker...', 'info');

        // Buat client baru
        this.client = new Paho.Client(
          MQTT_CONFIG.broker,
          MQTT_CONFIG.port,
          MQTT_CONFIG.clientId
        );

        // Set callback
        this.client.onConnectionLost = this.onConnectionLost.bind(this);
        this.client.onMessageArrived = this.onMessageArrived.bind(this);

        // Koneksi
        this.client.connect({
          onSuccess: this.onConnect.bind(this),
          onFailure: this.onConnectFailure.bind(this),
          timeout: 10
        });

      } catch (error) {
        console.error('❌ MQTT Error:', error);
        this.simulateConnection();
      }
    },

    /**
     * Simulasi koneksi (fallback jika library tidak tersedia)
     */
    simulateConnection() {
      console.log('🔌 MQTT: Mode simulasi aktif');
      this.isConnected = true;
      this.updateIndicator(true);
      showToast('📡 Mode simulasi - data dummy', 'warning');

      // Generate data dummy setiap 5 detik
      window.setInterval(() => {
        const data = this.generateDummyData();
        this.updateDashboard(data);
      }, 5000);
    },

    /**
     * Generate data dummy untuk simulasi
     */
    generateDummyData() {
      return {
        ph: (7.0 + Math.random() * 0.8).toFixed(2),
        turbidity: (1.0 + Math.random() * 3.0).toFixed(1),
        turbidityPercent: (97 - Math.random() * 6).toFixed(1),
        turbStatus: ['SANGAT JERNIH', 'JERNIH', 'CUKUP JERNIH'][Math.floor(Math.random() * 3)],
        temperature: (25 + Math.random() * 3).toFixed(1)
      };
    },

    /**
     * Callback saat koneksi berhasil
     */
    onConnect() {
      console.log('✅ MQTT: Terhubung ke broker');
      this.isConnected = true;
      this.updateIndicator(true);
      
      // Subscribe ke topics
      this.client.subscribe(MQTT_CONFIG.topics.ph);
      this.client.subscribe(MQTT_CONFIG.topics.turbidity);
      this.client.subscribe(MQTT_CONFIG.topics.status);
      
      console.log(`📡 MQTT: Subscribed ke topics:`, MQTT_CONFIG.topics);
      showToast('📡 MQTT broker terhubung', 'success');
    },

    /**
     * Callback saat koneksi gagal
     */
    onConnectFailure(error) {
      console.error('❌ MQTT: Gagal koneksi', error);
      this.isConnected = false;
      this.updateIndicator(false);
      showToast('⚠️ Gagal koneksi MQTT', 'error');
      
      // Retry dalam 10 detik
      window.setTimeout(() => {
        console.log('🔄 MQTT: Mencoba reconnect...');
        this.connect();
      }, 10000);
    },

    /**
     * Callback saat koneksi terputus
     */
    onConnectionLost(response) {
      console.log('🔌 MQTT: Koneksi terputus', response);
      this.isConnected = false;
      this.updateIndicator(false);
      showToast('⚠️ Koneksi MQTT terputus', 'error');
      
      // Retry dalam 5 detik
      window.setTimeout(() => {
        console.log('🔄 MQTT: Mencoba reconnect...');
        this.connect();
      }, 5000);
    },

    /**
     * Callback saat pesan MQTT diterima
     */
    onMessageArrived(message) {
      const topic = message.destinationName;
      const payload = message.payloadString;
      
      console.log(`📩 MQTT: Pesan dari ${topic}:`, payload);

      try {
        // Parse payload berdasarkan topic
        switch(topic) {
          case MQTT_CONFIG.topics.ph:
            state.ph = parseFloat(payload);
            break;
          
          case MQTT_CONFIG.topics.turbidity:
            const turbData = JSON.parse(payload);
            state.turbidity = parseFloat(turbData.ntu);
            state.turbidityPercent = parseFloat(turbData.percent);
            state.turbStatus = turbData.status;
            break;
          
          case MQTT_CONFIG.topics.status:
            const statusData = JSON.parse(payload);
            state.isOnline = statusData.status === 'online';
            state.rssi = statusData.rssi || 0;
            state.ip = statusData.ip || '--';
            // Update status indicator
            this.updateOnlineStatus(state.isOnline);
            break;
        }
        
        state.lastUpdate = new Date();
        this.updateDashboard(state);
        
      } catch (error) {
        console.error('❌ Error parsing MQTT payload:', error);
      }
    },

    /**
     * Update dashboard dengan data terbaru
     */
    updateDashboard(data) {
      // Update pH
      const phValue = document.querySelector('.metric-value[data-metric="ph"]');
      if (phValue) {
        phValue.textContent = data.ph;
      }
      
      // Update pH trend
      const phTrend = document.querySelector('.trend-head strong em');
      if (phTrend) {
        const change = (parseFloat(data.ph) - 7.2).toFixed(2);
        phTrend.textContent = `${change > 0 ? '+' : ''}${change}%`;
        phTrend.style.color = Math.abs(parseFloat(change)) > 0.3 ? '#e74c3c' : '#2ecc71';
      }

      // Update Turbidity
      const turbValue = document.querySelector('.metric-value[data-metric="turbidity"]');
      if (turbValue) {
        turbValue.textContent = data.turbidity || data.turbidityPercent;
      }
      
      // Update Turbidity trend
      const turbTrend = document.querySelector('.trend-head strong small');
      if (turbTrend) {
        turbTrend.textContent = `${data.turbidity || '0'} NTU`;
      }
      
      // Update status turbidity
      const turbStatusElement = document.querySelector('.metric-status[data-metric="turbidity"]');
      if (turbStatusElement) {
        turbStatusElement.textContent = data.turbStatus || 'JERNIH';
        // Update warna status
        const statusColors = {
          'SANGAT JERNIH': '#2ecc71',
          'JERNIH': '#2ecc71',
          'CUKUP JERNIH': '#f39c12',
          'AGAK KERUH': '#e67e22',
          'KERUH': '#e74c3c'
        };
        turbStatusElement.style.color = statusColors[data.turbStatus] || '#2ecc71';
      }

      // Update table (first row)
      const firstRow = document.querySelector('tbody tr:first-child');
      if (firstRow && data) {
        const cells = firstRow.querySelectorAll('td');
        if (cells.length >= 5) {
          const time = data.lastUpdate || new Date();
          cells[0].textContent = time.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          cells[1].textContent = data.ph || '--';
          cells[2].innerHTML = `${data.turbidity || '--'} <span>NTU</span>`;
          cells[3].textContent = data.temperature ? `${data.temperature}°C` : '--°C';
          
          // Status
          const statusCell = cells[4];
          const isLayak = parseFloat(data.ph) >= 6.5 && parseFloat(data.ph) <= 8.5;
          statusCell.innerHTML = isLayak 
            ? '<span class="badge success">LAYAK</span>' 
            : '<span class="badge danger">TIDAK LAYAK</span>';
        }
      }

      // Update live indicator
      this.updateLiveIndicator();
    },

    /**
     * Update indicator live data
     */
    updateLiveIndicator() {
      $$('.live-pill').forEach((pill) => {
        const time = new Date();
        pill.innerHTML = `<i></i> Live data · ${time.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })}`;
      });
    },

    /**
     * Update MQTT connection indicator
     */
    updateIndicator(isConnected) {
      const mqttIndicator = document.querySelector('.connection.mqtt');
      if (!mqttIndicator) return;

      if (isConnected) {
        mqttIndicator.classList.remove('offline');
        mqttIndicator.classList.add('online');
        mqttIndicator.style.borderColor = '#b9dced';
        mqttIndicator.style.background = '#f0f8fc';
        mqttIndicator.title = 'Broker MQTT terhubung';
        mqttIndicator.innerHTML = '● MQTT Online';
        mqttIndicator.style.color = '#2ecc71';
      } else {
        mqttIndicator.classList.remove('online');
        mqttIndicator.classList.add('offline');
        mqttIndicator.style.borderColor = '#f5c6cb';
        mqttIndicator.style.background = '#fdf0f0';
        mqttIndicator.title = 'Broker MQTT terputus';
        mqttIndicator.innerHTML = '● MQTT Offline';
        mqttIndicator.style.color = '#e74c3c';
      }
    },

    /**
     * Update online status dari topic ulum/status
     */
    updateOnlineStatus(isOnline) {
      const statusDot = document.querySelector('.status-dot');
      const statusText = document.querySelector('.status-text');
      
      if (statusDot) {
        statusDot.className = 'status-dot ' + (isOnline ? 'online' : 'offline');
      }
      
      if (statusText) {
        statusText.textContent = isOnline ? 'Online' : 'Offline';
        statusText.style.color = isOnline ? '#2ecc71' : '#e74c3c';
      }

      // Update status di header jika ada
      const headerStatus = document.querySelector('.header-status .status-badge');
      if (headerStatus) {
        headerStatus.textContent = isOnline ? '● Online' : '● Offline';
        headerStatus.style.color = isOnline ? '#2ecc71' : '#e74c3c';
      }
    },

    /**
     * Disconnect dari MQTT
     */
    disconnect() {
      if (this.client && this.isConnected) {
        this.client.disconnect();
        this.isConnected = false;
        this.updateIndicator(false);
        showToast('🔌 MQTT disconnected', 'info');
      }
    }
  };

  // Ekspos ke global
  window.mqtt = mqttClient;

  // ============================================
  // KEYBOARD ACCESSIBILITY
  // ============================================
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar?.classList.contains('open')) {
      closeMenu();
    }
  });

  // ============================================
  // INIT - Startup
  // ============================================
  console.log('🌊 AquaSense Dashboard v2.0.0 loaded successfully');
  console.log(`📅 ${new Date().toLocaleString('id-ID')}`);
  console.log('📡 MQTT Topics:');
  console.log('   - ulum/ph (pH value)');
  console.log('   - ulum/turb (Turbidity data)');
  console.log('   - ulum/status (ESP32 status)');
  console.log('ℹ️ Ketik "mqtt" di console untuk akses MQTT client');

  // ============================================
  // AUTO-CONNECT MQTT
  // ============================================
  // Tunggu 2 detik lalu konek ke MQTT
  window.setTimeout(() => {
    // Cek apakah Paho library tersedia
    if (typeof Paho !== 'undefined') {
      console.log('✅ Paho MQTT library ditemukan');
      mqttClient.connect();
    } else {
      console.warn('⚠️ Paho MQTT library tidak ditemukan');
      console.log('📡 Menggunakan mode simulasi...');
      mqttClient.simulateConnection();
    }
  }, 2000);

  // ============================================
  // SIMULASI DATA UNTUK DEMO (jika tidak ada MQTT)
  // ============================================
  // Jika tidak ada data dari MQTT dalam 10 detik, gunakan dummy
  let dataTimeout = window.setTimeout(() => {
    if (!state.lastUpdate) {
      console.log('📊 Menggunakan data dummy (tunggu MQTT)');
    }
  }, 10000);

})();
