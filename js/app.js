/**
 * AquaSense - Dashboard Monitoring Air
 * Terintegrasi dengan ESP32 via MQTT WebSocket
 * Topics: ulum/ph, ulum/turb, ulum/status
 * 
 * @version 2.0.0
 * @author ulum
 */

(() => {
  'use strict';

  // ==================== KONFIGURASI MQTT ====================
  const MQTT_CONFIG = {
    broker: 'wss://broker.hivemq.com:8884/mqtt',
    topics: {
      ph: 'ulum/ph',
      turbidity: 'ulum/turb',
      status: 'ulum/status'
    }
  };

  let client = null;
  let messageCount = 0;

  // ==================== DOM REFERENCES ====================
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  // ==================== STATE ====================
  const state = {
    mqttConnected: false,
    espOnline: false,
    messageCount: 0,
    lastData: null,
    lastUpdateTime: null,
    ph: null,
    turbidity: null,
    turbidityPercent: null,
    turbStatus: null,
    temperature: null,
    isOnline: false,
    rssi: 0,
    ip: '--',
  };

  // ==================== TOAST ====================
  let toastTimer = null;

  const showToast = (message, type = 'info') => {
    const toast = $('#toast');
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

  // ==================== UPDATE UI FUNCTIONS ====================
  function updatePH(value) {
    // Update nilai pH di card
    const phElements = document.querySelectorAll('.trend-head strong');
    phElements.forEach((el) => {
      const parent = el.closest('.trend');
      if (parent && parent.querySelector('.trend-head .muted')?.textContent.includes('pH')) {
        el.innerHTML = `${value.toFixed(2)} <em>${(Math.random() * 0.06 - 0.03).toFixed(2)}%</em>`;
      }
    });

    // Update status pH aman/tidak
    const phSafe = document.querySelector('.trend .safe.teal-bg');
    if (phSafe) {
      if (value >= 6.5 && value <= 8.5) {
        phSafe.textContent = 'Aman 6.5–8.5';
        phSafe.className = 'safe teal-bg';
      } else {
        phSafe.textContent = `⚠️ ${value.toFixed(2)}`;
        phSafe.className = 'safe warn';
      }
    }

    // Update pH di table
    const firstRow = document.querySelector('tbody tr:first-child');
    if (firstRow) {
      const cells = firstRow.querySelectorAll('td');
      if (cells.length >= 5) {
        cells[1].textContent = value.toFixed(2);
      }
    }
  }

  function updateTurbidity(ntu, percent, status) {
    // Update nilai turbidity di card
    const turbElements = document.querySelectorAll('.trend-head strong');
    turbElements.forEach((el) => {
      const parent = el.closest('.trend');
      if (parent && parent.querySelector('.trend-head .muted')?.textContent.includes('Kekeruhan')) {
        el.innerHTML = `${ntu.toFixed(1)} <small>NTU</small>`;
      }
    });

    // Update status turbidity
    const turbStatusElement = document.querySelector('.trend-head .safe.blue-bg');
    if (turbStatusElement) {
      if (ntu < 5) {
        turbStatusElement.textContent = `Aman < 5 NTU (${status || 'Jernih'})`;
        turbStatusElement.className = 'safe blue-bg';
      } else {
        turbStatusElement.textContent = `⚠️ ${ntu.toFixed(1)} NTU`;
        turbStatusElement.className = 'safe warn';
      }
    }

    // Update turbidity di table
    const firstRow = document.querySelector('tbody tr:first-child');
    if (firstRow) {
      const cells = firstRow.querySelectorAll('td');
      if (cells.length >= 5) {
        cells[2].innerHTML = `${ntu.toFixed(1)} <span>NTU</span>`;
      }
    }
  }

  function updateOverallStatus(ph, turbidity) {
    const isLayak = ph !== null && ph >= 6.5 && ph <= 8.5 && 
                    turbidity !== null && turbidity < 5;
    
    // Update status di card pertama
    const qualityStatus = document.querySelector('.summary-card:first-child .status');
    if (qualityStatus) {
      qualityStatus.textContent = isLayak ? '● Baik' : '● Peringatan';
      qualityStatus.className = `status ${isLayak ? 'good' : 'warn'}`;
    }

    const qualityValue = document.querySelector('.summary-card:first-child .big-value');
    if (qualityValue) {
      qualityValue.textContent = isLayak ? 'Optimal' : 'Perhatian';
    }

    const qualityDesc = document.querySelector('.summary-card:first-child .muted');
    if (qualityDesc) {
      if (isLayak) {
        qualityDesc.textContent = 'Semua parameter dalam batas aman';
      } else {
        let reason = '';
        if (ph !== null && (ph < 6.5 || ph > 8.5)) {
          reason = `pH ${ph.toFixed(2)} ${ph < 6.5 ? '(Asam)' : '(Basa)'}`;
        } else if (turbidity !== null && turbidity >= 5) {
          reason = `Kekeruhan ${turbidity.toFixed(1)} NTU (Tinggi)`;
        }
        qualityDesc.textContent = reason;
      }
    }

    // Update status di table
    const firstRow = document.querySelector('tbody tr:first-child');
    if (firstRow) {
      const cells = firstRow.querySelectorAll('td');
      if (cells.length >= 5) {
        const statusCell = cells[4];
        statusCell.innerHTML = isLayak 
          ? '<b class="status good">Normal</b>' 
          : '<b class="status warn">Perhatian</b>';
      }
    }
  }

  function updateSensorOnline(isOnline) {
    const sensorsValue = document.querySelector('.summary-card:nth-child(2) .big-value');
    if (sensorsValue) {
      sensorsValue.innerHTML = isOnline ? '2 <small>/ 2</small>' : '0 <small>/ 2</small>';
    }

    const onlineDot = document.querySelector('.summary-card:nth-child(2) .online-dot');
    if (onlineDot) {
      onlineDot.style.color = isOnline ? '#2ecc71' : '#e74c3c';
    }

    // Update Wi-Fi indicator
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

    // Update ESP badge
    const espBadge = document.querySelector('.connection.esp');
    if (espBadge) {
      if (isOnline) {
        espBadge.style.borderColor = '#bfe6d3';
        espBadge.style.background = '#f0fbf5';
        espBadge.title = 'ESP32 Online';
      } else {
        espBadge.style.borderColor = '#f5c6cb';
        espBadge.style.background = '#fdf0f0';
        espBadge.title = 'ESP32 Offline';
      }
    }
  }

  function updateLiveIndicator() {
    const time = new Date();
    $$('.live-pill').forEach((pill) => {
      const text = state.lastUpdateTime 
        ? `Data langsung · ${time.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}`
        : '⏳ Menunggu data...';
      pill.innerHTML = `<i></i> ${text}`;
    });
  }

  // ==================== MAIN UPDATE FUNCTION ====================
  function updateDashboard() {
    console.log('🔄 Updating dashboard with:', {
      ph: state.ph,
      turbidity: state.turbidity,
      turbStatus: state.turbStatus,
      isOnline: state.isOnline
    });

    // Update semua komponen
    if (state.ph !== null) {
      updatePH(state.ph);
    }

    if (state.turbidity !== null) {
      updateTurbidity(state.turbidity, state.turbidityPercent, state.turbStatus);
    }

    if (state.ph !== null && state.turbidity !== null) {
      updateOverallStatus(state.ph, state.turbidity);
    }

    updateSensorOnline(state.isOnline);
    updateLiveIndicator();

    // Update timestamp
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate && state.lastUpdateTime) {
      lastUpdate.textContent = state.lastUpdateTime.toLocaleTimeString();
    }

    const dataCount = document.getElementById('dataCount');
    if (dataCount) {
      dataCount.textContent = state.messageCount;
    }

    console.log('✅ Dashboard updated');
  }

  // ==================== MQTT LOGIC ====================
  function initMQTT() {
    console.log('🔄 Connecting to MQTT via WebSocket...');
    updateConnectionUI('connecting', 'Menghubungkan...');
    
    try {
      if (typeof Paho === 'undefined') {
        console.error('❌ Paho MQTT library tidak ditemukan!');
        showToast('❌ Library MQTT tidak ditemukan', 'error');
        return;
      }

      const Client = Paho.MQTT.Client;
      
      if (!Client) {
        console.error('❌ Paho.MQTT.Client tidak ditemukan');
        showToast('❌ Paho Client tidak ditemukan', 'error');
        return;
      }

      client = new Client(
        'broker.hivemq.com',
        8884,
        'aquasense_' + Math.random().toString(16).substr(2, 8)
      );

      client.onConnectionLost = onConnectionLost;
      client.onMessageArrived = onMessageArrived;

      client.connect({
        onSuccess: onConnect,
        onFailure: onConnectFailure,
        timeout: 10,
        keepAliveInterval: 30,
        useSSL: true
      });

    } catch (e) {
      console.error('❌ Connection error:', e);
      showToast('❌ Gagal koneksi MQTT: ' + e.message, 'error');
      setTimeout(initMQTT, 5000);
    }
  }

  function onConnect() {
    console.log('✅ Connected to MQTT Broker');
    state.mqttConnected = true;
    updateConnectionUI('connected', 'Broker Terhubung');
    
    const mqttBadge = document.querySelector('.connection.mqtt');
    if (mqttBadge) {
      mqttBadge.style.borderColor = '#b9dced';
      mqttBadge.style.background = '#f0f8fc';
      mqttBadge.title = 'Broker MQTT terhubung';
    }
    
    showToast('📡 MQTT broker terhubung', 'success');
    
    // Subscribe ke semua topics
    const topics = Object.values(MQTT_CONFIG.topics);
    topics.forEach(topic => {
      client.subscribe(topic, { qos: 1 });
      console.log('✅ Subscribed to:', topic);
    });
  }

  function onConnectFailure(error) {
    console.error('❌ MQTT Connection Failed:', error);
    state.mqttConnected = false;
    updateConnectionUI('disconnected', 'Gagal Koneksi');
    showToast('❌ Gagal koneksi MQTT', 'error');
    setTimeout(initMQTT, 10000);
  }

  function onConnectionLost(response) {
    console.log('🔌 MQTT Connection Lost:', response);
    state.mqttConnected = false;
    state.isOnline = false;
    updateConnectionUI('disconnected', 'Terputus');
    showToast('⚠️ Koneksi MQTT terputus', 'warning');
    updateSensorOnline(false);
    setTimeout(initMQTT, 5000);
  }

  function onMessageArrived(message) {
    const topic = message.destinationName;
    const payload = message.payloadString;
    
    console.log(`📥 [${topic}] => ${payload}`);
    
    try {
      switch(topic) {
        case MQTT_CONFIG.topics.ph:
          state.ph = parseFloat(payload);
          state.lastUpdateTime = new Date();
          state.messageCount++;
          updateDashboard();
          break;
        
        case MQTT_CONFIG.topics.turbidity:
          const turbData = JSON.parse(payload);
          state.turbidity = parseFloat(turbData.ntu);
          state.turbidityPercent = parseFloat(turbData.percent);
          state.turbStatus = turbData.status;
          state.lastUpdateTime = new Date();
          state.messageCount++;
          updateDashboard();
          break;
        
        case MQTT_CONFIG.topics.status:
          const statusData = JSON.parse(payload);
          state.isOnline = statusData.status === 'online';
          state.rssi = statusData.rssi || 0;
          state.ip = statusData.ip || '--';
          state.lastUpdateTime = new Date();
          state.messageCount++;
          updateSensorOnline(state.isOnline);
          updateLiveIndicator();
          console.log(`📡 ESP32 Status: ${statusData.status} | IP: ${statusData.ip} | RSSI: ${statusData.rssi}dBm`);
          break;
      }
      
      // Update ESP badge
      const espBadge = document.querySelector('.connection.esp');
      if (espBadge && state.isOnline) {
        espBadge.style.borderColor = '#bfe6d3';
        espBadge.style.background = '#f0fbf5';
        espBadge.title = `ESP32 Online (${state.ip})`;
      }
      
    } catch (error) {
      console.error('❌ Error parsing MQTT payload:', error);
    }
  }

  function updateConnectionUI(status, text) {
    const connText = document.getElementById('connectionText');
    const connDot = document.getElementById('connectionDot');
    
    if (connText) connText.textContent = text;
    if (connDot) {
      connDot.className = `dot ${status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected'}`;
    }
  }

  // ==================== SIDEBAR NAVIGATION ====================
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');

  const closeMenu = () => {
    sidebar?.classList.remove('open');
    scrim?.classList.remove('show');
  };

  const openMenu = () => {
    sidebar?.classList.add('open');
    scrim?.classList.add('show');
  };

  document.getElementById('open-menu')?.addEventListener('click', openMenu);
  document.getElementById('close-menu')?.addEventListener('click', closeMenu);
  scrim?.addEventListener('click', closeMenu);

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active'));
      item.classList.add('active');
      closeMenu();
    });
  });

  // ==================== TABS ====================
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((btn) => btn.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // ==================== BUTTON INTERACTIONS ====================
  document.getElementById('configure')?.addEventListener('click', () => {
    showToast('⚙️ Konfigurasi stasiun', 'info');
  });

  document.getElementById('view-alerts')?.addEventListener('click', () => {
    showToast('🔔 Menampilkan peringatan aktif', 'info');
  });

  document.getElementById('refresh-status')?.addEventListener('click', (event) => {
    const button = event.currentTarget;
    const originalText = button.textContent;

    button.textContent = 'Memeriksa…';
    button.disabled = true;

    window.setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
      
      if (state.mqttConnected) {
        showToast('✅ MQTT terhubung', 'success');
      } else {
        showToast('⚠️ MQTT terputus, mencoba reconnect...', 'warning');
        initMQTT();
      }
    }, 800);
  });

  // ==================== KEYBOARD ACCESSIBILITY ====================
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar?.classList.contains('open')) {
      closeMenu();
    }
  });

  // ==================== INITIALIZE ====================
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🌊 AquaSense Dashboard v2.0.0');
    console.log('📡 MQTT Topics:');
    console.log('   - ulum/ph (pH value)');
    console.log('   - ulum/turb (Turbidity data)');
    console.log('   - ulum/status (ESP32 status)');
    console.log('');
    console.log('📊 Menunggu data dari ESP32...');
    console.log('💡 Pastikan ESP32 sudah terhubung ke WiFi dan MQTT');
    
    initMQTT();
  });

  // ==================== EXPOSE FOR DEBUG ====================
  window.debug = {
    state: state,
    client: client,
    MQTT_CONFIG: MQTT_CONFIG,
    initMQTT: initMQTT,
    updateDashboard: updateDashboard
  };

  console.log('🔧 Debug: Type "debug" in console to see state');

})();
