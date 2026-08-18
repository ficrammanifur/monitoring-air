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

  // ============================================
  // STATE
  // ============================================
  const state = {
    ph: 7.42,
    turbidity: 1.8,
    turbidityPercent: 98.2,
    turbStatus: 'JERNIH',
    temperature: 26.4,
    isOnline: false,
    lastUpdate: null,
    rssi: 0,
    ip: '--',
    history: {
      ph: [],
      turbidity: []
    }
  };

  // ============================================
  // TOAST NOTIFICATION
  // ============================================
  let toastTimer = null;

  const showToast = (message, type = 'info') => {
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'show';
    
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

    connect() {
      if (typeof Paho === 'undefined') {
        console.warn('⚠️ Paho MQTT library tidak ditemukan. Gunakan mode simulasi.');
        this.simulateConnection();
        return;
      }

      try {
        console.log('🔌 MQTT: Menghubungkan ke broker...');
        showToast('📡 Menghubungkan ke MQTT broker...', 'info');

        this.client = new Paho.Client(
          MQTT_CONFIG.broker,
          MQTT_CONFIG.port,
          MQTT_CONFIG.clientId
        );

        this.client.onConnectionLost = this.onConnectionLost.bind(this);
        this.client.onMessageArrived = this.onMessageArrived.bind(this);

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

    simulateConnection() {
      console.log('🔌 MQTT: Mode simulasi aktif');
      this.isConnected = true;
      this.updateIndicator(true);
      showToast('📡 Mode simulasi - data dummy', 'warning');

      window.setInterval(() => {
        const data = this.generateDummyData();
        this.updateDashboard(data);
      }, 5000);
    },

    generateDummyData() {
      return {
        ph: (7.0 + Math.random() * 0.8).toFixed(2),
        turbidity: (1.0 + Math.random() * 3.0).toFixed(1),
        turbidityPercent: (97 - Math.random() * 6).toFixed(1),
        turbStatus: ['SANGAT JERNIH', 'JERNIH', 'CUKUP JERNIH'][Math.floor(Math.random() * 3)],
        temperature: (25 + Math.random() * 3).toFixed(1)
      };
    },

    onConnect() {
      console.log('✅ MQTT: Terhubung ke broker');
      this.isConnected = true;
      this.updateIndicator(true);
      
      this.client.subscribe(MQTT_CONFIG.topics.ph);
      this.client.subscribe(MQTT_CONFIG.topics.turbidity);
      this.client.subscribe(MQTT_CONFIG.topics.status);
      
      console.log(`📡 MQTT: Subscribed ke topics:`, MQTT_CONFIG.topics);
      showToast('📡 MQTT broker terhubung', 'success');
    },

    onConnectFailure(error) {
      console.error('❌ MQTT: Gagal koneksi', error);
      this.isConnected = false;
      this.updateIndicator(false);
      showToast('⚠️ Gagal koneksi MQTT', 'error');
      
      window.setTimeout(() => {
        console.log('🔄 MQTT: Mencoba reconnect...');
        this.connect();
      }, 10000);
    },

    onConnectionLost(response) {
      console.log('🔌 MQTT: Koneksi terputus', response);
      this.isConnected = false;
      this.updateIndicator(false);
      showToast('⚠️ Koneksi MQTT terputus', 'error');
      
      window.setTimeout(() => {
        console.log('🔄 MQTT: Mencoba reconnect...');
        this.connect();
      }, 5000);
    },

    onMessageArrived(message) {
      const topic = message.destinationName;
      const payload = message.payloadString;
      
      console.log(`📩 MQTT: Pesan dari ${topic}:`, payload);

      try {
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
            this.updateOnlineStatus(state.isOnline);
            break;
        }
        
        state.lastUpdate = new Date();
        
        // Simpan history untuk chart
        this.updateHistory(state);
        
        // Update dashboard
        this.updateDashboard(state);
        
      } catch (error) {
        console.error('❌ Error parsing MQTT payload:', error);
      }
    },

    updateHistory(data) {
      // Simpan history pH
      state.history.ph.push({
        time: new Date(),
        value: parseFloat(data.ph)
      });
      if (state.history.ph.length > 20) {
        state.history.ph.shift();
      }

      // Simpan history turbidity
      state.history.turbidity.push({
        time: new Date(),
        value: parseFloat(data.turbidity)
      });
      if (state.history.turbidity.length > 20) {
        state.history.turbidity.shift();
      }
    },

    updateDashboard(data) {
      // ========== UPDATE PH ==========
      // Update nilai pH di card
      const phDisplay = document.querySelector('.trend-head strong em');
      if (phDisplay) {
        const currentPh = parseFloat(data.ph);
        const phElement = phDisplay.closest('.trend-head').querySelector('strong');
        if (phElement) {
          // Update nilai pH
          phElement.innerHTML = `${currentPh.toFixed(2)} <em>${(Math.random() * 0.06 - 0.03).toFixed(2)}%</em>`;
        }
      }

      // Update pH di status card
      const phValueElement = document.querySelector('.metric-value[data-metric="ph"]');
      if (phValueElement) {
        phValueElement.textContent = data.ph;
      }

      // ========== UPDATE TURBIDITY ==========
      // Update nilai turbidity di card
      const turbDisplay = document.querySelector('.trend-head strong small');
      if (turbDisplay) {
        const turbElement = turbDisplay.closest('.trend-head').querySelector('strong');
        if (turbElement) {
          // Update nilai turbidity
          turbElement.innerHTML = `${data.turbidity || '0'} <small>NTU</small>`;
        }
      }

      // Update status turbidity
      const turbStatusElement = document.querySelector('.metric-status[data-metric="turbidity"]');
      if (turbStatusElement) {
        turbStatusElement.textContent = data.turbStatus || 'JERNIH';
        const statusColors = {
          'SANGAT JERNIH': '#2ecc71',
          'JERNIH': '#2ecc71',
          'CUKUP JERNIH': '#f39c12',
          'AGAK KERUH': '#e67e22',
          'KERUH': '#e74c3c'
        };
        turbStatusElement.style.color = statusColors[data.turbStatus] || '#2ecc71';
      }

      // ========== UPDATE OVERALL STATUS ==========
      // Update status overall water quality
      const phVal = parseFloat(data.ph);
      const turbVal = parseFloat(data.turbidity);
      const isLayak = phVal >= 6.5 && phVal <= 8.5 && turbVal < 5;
      
      const qualityStatus = document.querySelector('.summary-card .status');
      if (qualityStatus) {
        qualityStatus.textContent = isLayak ? '● Good' : '● Warning';
        qualityStatus.className = `status ${isLayak ? 'good' : 'warn'}`;
      }

      const qualityValue = document.querySelector('.summary-card .big-value');
      if (qualityValue) {
        qualityValue.textContent = isLayak ? 'Optimal' : 'Perhatian';
      }

      const qualityDesc = document.querySelector('.summary-card .muted');
      if (qualityDesc) {
        qualityDesc.textContent = isLayak 
          ? 'All parameters within safe limits' 
          : `pH ${phVal.toFixed(2)} ${phVal < 6.5 ? '(Rendah)' : '(Tinggi)'}`;
      }

      // ========== UPDATE TABLE ==========
      const firstRow = document.querySelector('tbody tr:first-child');
      if (firstRow && data) {
        const cells = firstRow.querySelectorAll('td');
        if (cells.length >= 5) {
          const time = data.lastUpdate || new Date();
          cells[0].textContent = time.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
          });
          cells[1].textContent = data.ph || '--';
          cells[2].innerHTML = `${data.turbidity || '--'} <span>NTU</span>`;
          cells[3].textContent = data.temperature ? `${data.temperature}°C` : '--°C';
          
          // Status di table
          const isRowLayak = phVal >= 6.5 && phVal <= 8.5;
          const statusCell = cells[4];
          statusCell.innerHTML = isRowLayak 
            ? '<b class="status good">Normal</b>' 
            : '<b class="status warn">Perhatian</b>';
        }
      }

      // ========== UPDATE ALERTS ==========
      // Update alert jika turbidity tinggi
      const alertList = document.querySelector('.alert-list');
      if (alertList && turbVal > 2.0) {
        // Hapus alert lama
        const existingAlert = alertList.querySelector('.alert-row[data-alert="turbidity"]');
        if (existingAlert) {
          existingAlert.remove();
        }
        
        // Tambah alert baru jika belum ada
        if (!alertList.querySelector('.alert-row[data-alert="turbidity"]')) {
          const newAlert = document.createElement('div');
          newAlert.className = 'alert-row';
          newAlert.dataset.alert = 'turbidity';
          newAlert.innerHTML = `
            <span class="alert-icon amber">!</span>
            <div>
              <strong>Elevated turbidity detected</strong>
              <span class="muted">Turbidity reached ${turbVal.toFixed(1)} NTU at ${new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
            <span class="status warn">Monitoring</span>
          `;
          alertList.prepend(newAlert);
        }
      }

      // ========== UPDATE LIVE INDICATOR ==========
      this.updateLiveIndicator();
    },

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

    updateIndicator(isConnected) {
      const mqttIndicator = document.querySelector('.connection.mqtt');
      if (!mqttIndicator) return;

      if (isConnected) {
        mqttIndicator.classList.remove('offline');
        mqttIndicator.classList.add('online');
        mqttIndicator.style.borderColor = '#b9dced';
        mqttIndicator.style.background = '#f0f8fc';
        mqttIndicator.title = 'Broker MQTT terhubung';
        mqttIndicator.innerHTML = '<span>◌</span><b>MQTT</b><i></i>';
        mqttIndicator.querySelector('i').style.background = '#2b82c6';
      } else {
        mqttIndicator.classList.remove('online');
        mqttIndicator.classList.add('offline');
        mqttIndicator.style.borderColor = '#f5c6cb';
        mqttIndicator.style.background = '#fdf0f0';
        mqttIndicator.title = 'Broker MQTT terputus';
        mqttIndicator.innerHTML = '<span>◌</span><b>MQTT</b><i></i>';
        mqttIndicator.querySelector('i').style.background = '#e74c3c';
      }
    },

    updateOnlineStatus(isOnline) {
      const wifiIndicator = document.querySelector('.connection.wifi');
      if (wifiIndicator) {
        if (isOnline) {
          wifiIndicator.style.borderColor = '#bfe6d3';
          wifiIndicator.style.background = '#f0fbf5';
          wifiIndicator.title = 'Wi-Fi terhubung';
        } else {
          wifiIndicator.style.borderColor = '#f5c6cb';
          wifiIndicator.style.background = '#fdf0f0';
          wifiIndicator.title = 'Wi-Fi terputus';
        }
      }

      // Update sensor online status
      const sensorsOnline = document.querySelector('.summary-card .online-dot');
      if (sensorsOnline) {
        sensorsOnline.style.color = isOnline ? '#2ecc71' : '#e74c3c';
      }

      const sensorsValue = document.querySelector('.summary-card .big-value small');
      if (sensorsValue) {
        sensorsValue.textContent = isOnline ? '/ 2' : '/ 0';
      }
    },

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
  window.setTimeout(() => {
    if (typeof Paho !== 'undefined') {
      console.log('✅ Paho MQTT library ditemukan');
      mqttClient.connect();
    } else {
      console.warn('⚠️ Paho MQTT library tidak ditemukan');
      console.log('📡 Menggunakan mode simulasi...');
      mqttClient.simulateConnection();
    }
  }, 2000);

})();
