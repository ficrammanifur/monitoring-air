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

  const DOM = {
    connDot: $('#connectionDot'),
    connText: $('#connectionText'),
    mqttBadge: $('#mqttBadge'),
    espBadge: $('#espBadge'),
    lastUpdate: $('#lastUpdate'),
    dataCount: $('#dataCount'),
    lastMessage: $('#lastMessage'),
    waterStatusText: $('#waterStatusText'),
    statusIconWrapper: $('#statusIconWrapper'),
    statusDetail: $('#statusDetail'),
    filterHealth: $('#filterHealth'),
    healthBar: $('#healthBar'),
    daysLeft: $('#daysLeft'),
    volumeTotal: $('#volumeTotal'),
    phValue: $('#phValue'),
    turbidityValue: $('#turbidityValue'),
    tempValue: $('#tempValue'),
    phBadge: $('#phBadge'),
    turbBadge: $('#turbBadge'),
    tempBadge: $('#tempBadge'),
    filterReplaceStatus: $('#filterReplaceStatus'),
    filterReplaceScore: $('#filterReplaceScore'),
    filterReplaceDays: $('#filterReplaceDays'),
    filterReplaceReason: $('#filterReplaceReason'),
    filterReplaceRecommend: $('#filterReplaceRecommend'),
  };

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
    status: null,
    health: null,
    daysLeft: null,
    isOnline: false,
    rssi: 0,
    ip: '--',
    filterNeedReplacement: false,
    filterReason: 'Normal',
    filterRecommendation: 'Lanjutkan pemantauan',
    filterScore: 100,
    filterStatus: 'NORMAL',
    filterStatusColor: 'GREEN',
    filterStatusEmoji: '🟢',
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

  // ==================== MQTT LOGIC - Menggunakan Paho MQTT ====================
  function initMQTT() {
    console.log('🔄 Connecting to MQTT via WebSocket...');
    updateConnectionUI('connecting', 'Menghubungkan...');
    
    try {
      // Cek apakah Paho tersedia
      if (typeof Paho === 'undefined') {
        console.error('❌ Paho MQTT library tidak ditemukan!');
        showToast('❌ Library MQTT tidak ditemukan', 'error');
        return;
      }

      // Gunakan Paho.MQTT.Client untuk WebSocket
      const Client = Paho.MQTT.Client;
      
      if (!Client) {
        console.error('❌ Paho.MQTT.Client tidak ditemukan');
        showToast('❌ Paho Client tidak ditemukan', 'error');
        return;
      }

      // Buat client dengan WebSocket
      client = new Client(
        'broker.hivemq.com',
        8884,
        'aquasense_' + Math.random().toString(16).substr(2, 8)
      );

      // Set callback
      client.onConnectionLost = onConnectionLost;
      client.onMessageArrived = onMessageArrived;

      // Connect
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
    if (DOM.mqttBadge) DOM.mqttBadge.className = 'badge active';
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
    if (DOM.mqttBadge) DOM.mqttBadge.className = 'badge inactive';
    showToast('❌ Gagal koneksi MQTT', 'error');
    
    setTimeout(initMQTT, 10000);
  }

  function onConnectionLost(response) {
    console.log('🔌 MQTT Connection Lost:', response);
    state.mqttConnected = false;
    state.espOnline = false;
    updateConnectionUI('disconnected', 'Terputus');
    if (DOM.mqttBadge) DOM.mqttBadge.className = 'badge inactive';
    if (DOM.espBadge) DOM.espBadge.className = 'badge inactive';
    showToast('⚠️ Koneksi MQTT terputus', 'warning');
    
    setTimeout(initMQTT, 5000);
  }

  function onMessageArrived(message) {
    const topic = message.destinationName;
    const payload = message.payloadString;
    
    console.log(`📥 Message on ${topic}:`, payload);
    
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
          state.espOnline = state.isOnline;
          break;
      }
      
      state.lastUpdateTime = new Date();
      state.messageCount++;
      state.espOnline = true;
      
      if (DOM.espBadge) DOM.espBadge.className = 'badge active';
      updateUI();
      
    } catch (error) {
      console.error('❌ Error parsing MQTT payload:', error);
    }
  }

  function updateConnectionUI(status, text) {
    if (DOM.connText) DOM.connText.textContent = text;
    if (DOM.connDot) {
      DOM.connDot.className = `dot ${status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected'}`;
    }
  }

  // ==================== UI UPDATES ====================
  function updateUI() {
    console.log('🔄 Updating UI...');
    
    // 1. Update timestamp
    if (state.lastUpdateTime && DOM.lastUpdate) {
      DOM.lastUpdate.textContent = state.lastUpdateTime.toLocaleTimeString();
    }
    if (DOM.dataCount) {
      DOM.dataCount.textContent = state.messageCount;
    }
    
    // 2. Update Status
    const isLayak = state.ph !== null && state.ph >= 6.5 && state.ph <= 8.5 && 
                    state.turbidity !== null && state.turbidity < 5;
    
    if (DOM.waterStatusText) {
      DOM.waterStatusText.textContent = isLayak ? 'LAYAK' : 'TIDAK LAYAK';
      DOM.waterStatusText.className = isLayak ? 'good-text' : 'bad-text';
    }
    
    if (DOM.statusIconWrapper) {
      if (isLayak) {
        DOM.statusIconWrapper.className = 'status-icon-wrapper good';
        DOM.statusIconWrapper.innerHTML = '<i class="fa-solid fa-check"></i>';
        if (DOM.statusDetail) DOM.statusDetail.textContent = 'Air aman untuk dikonsumsi';
      } else {
        DOM.statusIconWrapper.className = 'status-icon-wrapper bad';
        DOM.statusIconWrapper.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        let reason = '';
        if (state.ph !== null && (state.ph < 6.5 || state.ph > 8.5)) {
          reason = `pH ${state.ph.toFixed(2)} ${state.ph < 6.5 ? '(Asam)' : '(Basa)'}`;
        } else if (state.turbidity !== null && state.turbidity >= 5) {
          reason = `Kekeruhan ${state.turbidity.toFixed(1)} NTU (Tinggi)`;
        }
        if (DOM.statusDetail) DOM.statusDetail.textContent = `Air tidak layak: ${reason}`;
      }
    }
    
    // 3. Update Sensors
    if (state.ph !== null && DOM.phValue) {
      DOM.phValue.textContent = state.ph.toFixed(2);
      updateParamBadge(DOM.phBadge, state.ph, 6.5, 8.5, 'Aman', 'Waspada', 'Bahaya');
    }
    
    if (state.turbidity !== null && DOM.turbidityValue) {
      DOM.turbidityValue.textContent = state.turbidity.toFixed(2);
      updateParamBadge(DOM.turbBadge, state.turbidity, 0, 5, 'Jernih', 'Keruh', 'Sangat Keruh', true);
    }
    
    // 4. Update Filter Health
    if (state.health !== null && DOM.filterHealth) {
      const health = state.health;
      DOM.filterHealth.textContent = `${Math.round(health)}%`;
      if (DOM.healthBar) {
        DOM.healthBar.style.width = `${Math.min(health, 100)}%`;
        if (health > 70) {
          DOM.healthBar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
        } else if (health > 40) {
          DOM.healthBar.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
        } else {
          DOM.healthBar.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
        }
      }
    }
    
    if (state.daysLeft !== null && DOM.daysLeft) {
      DOM.daysLeft.textContent = `${state.daysLeft} hari`;
    }
    
    // 5. Update Filter Replacement Status
    updateFilterReplacement();
    
    // 6. Update Online Status
    if (DOM.espBadge) {
      DOM.espBadge.className = state.espOnline ? 'badge active' : 'badge inactive';
    }
    
    // Update Wi-Fi indicator
    const wifiIndicator = document.querySelector('.connection.wifi');
    if (wifiIndicator) {
      if (state.isOnline) {
        wifiIndicator.style.borderColor = '#bfe6d3';
        wifiIndicator.style.background = '#f0fbf5';
        wifiIndicator.title = 'Wi-Fi terhubung';
      } else {
        wifiIndicator.style.borderColor = '#f5c6cb';
        wifiIndicator.style.background = '#fdf0f0';
        wifiIndicator.title = 'Wi-Fi terputus';
      }
    }
    
    console.log('✅ UI Update complete');
  }

  // ==================== FILTER REPLACEMENT ====================
  function updateFilterReplacement() {
    const filterScore = state.health || state.filterScore || 100;
    
    let statusText = 'NORMAL';
    let statusColor = 'GREEN';
    let statusEmoji = '🟢';
    
    if (filterScore < 40) {
      statusText = 'GANTI';
      statusColor = 'RED';
      statusEmoji = '🔴';
    } else if (filterScore < 70) {
      statusText = 'CEK';
      statusColor = 'YELLOW';
      statusEmoji = '🟡';
    }
    
    let ledClass = statusColor === 'GREEN' ? 'led-green' : statusColor === 'YELLOW' ? 'led-yellow' : 'led-red';
    let textClass = statusColor === 'GREEN' ? 'text-filter-normal' : statusColor === 'YELLOW' ? 'text-filter-check' : 'text-filter-replace';
    
    if (DOM.filterReplaceStatus) {
      DOM.filterReplaceStatus.innerHTML = `
        <span class="status-led ${ledClass}"></span>
        <span class="${textClass}">${statusEmoji} ${statusText}</span>
        <span class="text-xs text-white/40 ml-1">(${filterScore.toFixed(0)}%)</span>
      `;
    }
    
    if (DOM.filterReplaceScore) {
      DOM.filterReplaceScore.textContent = filterScore.toFixed(0) + '%';
      DOM.filterReplaceScore.className = `text-sm font-mono font-bold ${
        filterScore < 40 ? 'text-[#FF2A54]' : filterScore < 70 ? 'text-[#FFD700]' : 'text-[#00FF66]'
      }`;
    }
    
    if (DOM.filterReplaceDays) {
      const days = state.daysLeft || 0;
      if (days > 0) {
        DOM.filterReplaceDays.textContent = days + ' hari';
        DOM.filterReplaceDays.className = 'text-sm font-mono text-white';
      } else {
        DOM.filterReplaceDays.textContent = '⚠️ Segera!';
        DOM.filterReplaceDays.className = 'text-sm font-mono text-[#FF2A54] font-bold';
      }
    }
    
    if (DOM.filterReplaceReason) {
      DOM.filterReplaceReason.textContent = state.filterReason || 'Normal';
    }
    
    if (DOM.filterReplaceRecommend) {
      DOM.filterReplaceRecommend.textContent = state.filterRecommendation || 'Lanjutkan pemantauan';
    }
  }

  // ==================== BADGE HELPER ====================
  function updateParamBadge(element, value, minSafe, maxSafe, safeLabel, warnLabel, dangerLabel, isLowerBetter = false) {
    if (!element) return;
    
    if (value === null || value === undefined) {
      element.textContent = '--';
      element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-white/40 border border-white/10 uppercase tracking-wider';
      return;
    }
    
    let className = '';
    let label = '';
    
    if (isLowerBetter) {
      if (value <= maxSafe) {
        label = safeLabel;
        className = 'bg-[#00FF66]/15 text-[#00FF66] border-[#00FF66]/30';
      } else if (value <= maxSafe * 2) {
        label = warnLabel;
        className = 'bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/30';
      } else {
        label = dangerLabel;
        className = 'bg-[#FF2A54]/15 text-[#FF2A54] border-[#FF2A54]/30 animate-pulse';
      }
    } else {
      if (value >= minSafe && value <= maxSafe) {
        label = safeLabel;
        className = 'bg-[#00FF66]/15 text-[#00FF66] border-[#00FF66]/30';
      } else if (value < minSafe - 1 || value > maxSafe + 1) {
        label = dangerLabel;
        className = 'bg-[#FF2A54]/15 text-[#FF2A54] border-[#FF2A54]/30 animate-pulse';
      } else {
        label = warnLabel;
        className = 'bg-[#FFD700]/15 text-[#FFD700] border-[#FFD700]/30';
      }
    }
    
    element.textContent = label;
    element.className = `inline-block px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${className}`;
  }

  // ==================== AUTO-RECONNECT ====================
  setInterval(() => {
    if (state.lastUpdateTime) {
      const now = new Date();
      const diff = (now - state.lastUpdateTime) / 1000;
      if (diff > 15 && state.espOnline) {
        state.espOnline = false;
        if (DOM.espBadge) DOM.espBadge.className = 'badge inactive';
      }
    }
  }, 5000);

  // ==================== SIDEBAR NAVIGATION ====================
  const sidebar = $('#sidebar');
  const scrim = $('#scrim');

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
      closeMenu();
    });
  });

  // ==================== TABS ====================
  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach((btn) => btn.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  // ==================== BUTTON INTERACTIONS ====================
  $('#configure')?.addEventListener('click', () => {
    showToast('⚙️ Konfigurasi stasiun', 'info');
  });

  $('#view-alerts')?.addEventListener('click', () => {
    showToast('🔔 Menampilkan peringatan aktif', 'info');
  });

  $('#refresh-status')?.addEventListener('click', (event) => {
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
    console.log('ℹ️ Ketik "debug" di console untuk akses state');
    
    initMQTT();
  });

  // ==================== EXPOSE FOR DEBUG ====================
  window.debug = {
    state: state,
    client: client,
    MQTT_CONFIG: MQTT_CONFIG,
    initMQTT: initMQTT
  };

  console.log('🔧 Debug: Type "debug" in console to see state');

})();
