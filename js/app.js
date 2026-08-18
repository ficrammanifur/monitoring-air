/**
 * AquaSense - Dashboard Monitoring Air
 * Terintegrasi dengan ESP32 via MQTT
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
    // Connection
    connDot: $('#connectionDot'),
    connText: $('#connectionText'),
    mqttBadge: $('#mqttBadge'),
    espBadge: $('#espBadge'),
    lastUpdate: $('#lastUpdate'),
    dataCount: $('#dataCount'),
    lastMessage: $('#lastMessage'),
    
    // Status
    waterStatusText: $('#waterStatusText'),
    statusIconWrapper: $('#statusIconWrapper'),
    statusDetail: $('#statusDetail'),
    
    // Filter
    filterHealth: $('#filterHealth'),
    healthBar: $('#healthBar'),
    daysLeft: $('#daysLeft'),
    volumeTotal: $('#volumeTotal'),
    
    // Sensors
    phValue: $('#phValue'),
    tdsValue: $('#tdsValue'),
    turbidityValue: $('#turbidityValue'),
    tempValue: $('#tempValue'),
    phBadge: $('#phBadge'),
    tdsBadge: $('#tdsBadge'),
    turbBadge: $('#turbBadge'),
    tempBadge: $('#tempBadge'),
    
    // Filter Replacement
    filterReplaceStatus: $('#filterReplaceStatus'),
    filterReplaceScore: $('#filterReplaceScore'),
    filterReplaceDays: $('#filterReplaceDays'),
    filterReplaceReason: $('#filterReplaceReason'),
    filterReplaceRecommend: $('#filterReplaceRecommend'),
  };

  // ==================== STATE ====================
  const state = {
    connected: false,
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
    volume: null,
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
    phWarning: false,
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

  // ==================== CHARTS ====================
  let charts = {
    ph: null,
    turbidity: null,
    labels: [],
    phData: [],
    turbidityData: [],
    maxPoints: 20
  };

  function initCharts() {
    // pH Chart
    const phCtx = document.getElementById('phChart');
    if (phCtx) {
      const ctx = phCtx.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

      charts.ph = new Chart(ctx, {
        type: 'line',
        data: {
          labels: charts.labels,
          datasets: [{
            data: charts.phData,
            borderColor: '#00F0FF',
            backgroundColor: gradient,
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(6,19,37,0.9)',
              titleColor: '#fff',
              bodyColor: '#00F0FF',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              padding: 10,
            }
          },
          scales: {
            x: { 
              grid: { display: false }, 
              ticks: { maxTicksLimit: 6, color: 'rgba(255,255,255,0.3)' } 
            },
            y: { 
              min: 0, 
              max: 14, 
              grid: { color: 'rgba(255,255,255,0.05)' }, 
              ticks: { color: 'rgba(255,255,255,0.3)' } 
            }
          }
        }
      });
    }

    // Turbidity Chart
    const turbCtx = document.getElementById('turbidityChart');
    if (turbCtx) {
      const ctx = turbCtx.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 0, 200);
      gradient.addColorStop(0, 'rgba(0, 255, 102, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 255, 102, 0.0)');

      charts.turbidity = new Chart(ctx, {
        type: 'line',
        data: {
          labels: charts.labels,
          datasets: [{
            data: charts.turbidityData,
            borderColor: '#00FF66',
            backgroundColor: gradient,
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(6,19,37,0.9)',
              titleColor: '#fff',
              bodyColor: '#00FF66',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              padding: 10,
            }
          },
          scales: {
            x: { 
              grid: { display: false }, 
              ticks: { maxTicksLimit: 6, color: 'rgba(255,255,255,0.3)' } 
            },
            y: { 
              min: 0, 
              max: 10, 
              grid: { color: 'rgba(255,255,255,0.05)' }, 
              ticks: { color: 'rgba(255,255,255,0.3)' } 
            }
          }
        }
      });
    }
  }

  function updateCharts(ph, turbidity) {
    const now = new Date();
    const label = now.getHours().toString().padStart(2, '0') + ':' + 
                  now.getMinutes().toString().padStart(2, '0');

    if (ph !== null && ph !== undefined) {
      charts.labels.push(label);
      charts.phData.push(ph);
      if (charts.labels.length > charts.maxPoints) {
        charts.labels.shift();
        charts.phData.shift();
      }
      if (charts.ph) {
        charts.ph.data.labels = charts.labels;
        charts.ph.data.datasets[0].data = charts.phData;
        charts.ph.update('none');
      }
    }

    if (turbidity !== null && turbidity !== undefined) {
      charts.turbidityData.push(turbidity);
      if (charts.turbidityData.length > charts.maxPoints) {
        charts.turbidityData.shift();
      }
      if (charts.turbidity) {
        charts.turbidity.data.labels = charts.labels;
        charts.turbidity.data.datasets[0].data = charts.turbidityData;
        charts.turbidity.update('none');
      }
    }
  }

  // ==================== MQTT LOGIC ====================
  function initMQTT() {
    console.log('🔄 Connecting to MQTT...');
    updateConnectionUI('connecting', 'Menghubungkan...');
    
    try {
      client = mqtt.connect(MQTT_CONFIG.broker, {
        clientId: 'aquasense_' + Math.random().toString(16).substr(2, 8),
        reconnectPeriod: 3000,
        keepAlive: 60,
        clean: true
      });

      client.on('connect', () => {
        console.log('✅ Connected to MQTT Broker');
        state.mqttConnected = true;
        updateConnectionUI('connected', 'Broker Terhubung');
        if (DOM.mqttBadge) DOM.mqttBadge.className = 'badge active';
        showToast('📡 MQTT broker terhubung', 'success');
        
        // Subscribe ke semua topics
        const topics = Object.values(MQTT_CONFIG.topics);
        topics.forEach(topic => {
          client.subscribe(topic, { qos: 1 }, (err) => {
            if (!err) {
              console.log('✅ Subscribed to:', topic);
            } else {
              console.error('❌ Subscribe error:', err);
            }
          });
        });
      });

      client.on('message', (topic, message) => {
        console.log(`📥 Message on ${topic}:`, message.toString());
        
        try {
          const payload = message.toString();
          
          // Parse berdasarkan topic
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
      });

      client.on('error', (error) => {
        console.error('❌ MQTT Error:', error);
        state.mqttConnected = false;
        updateConnectionUI('disconnected', 'Error Koneksi');
        if (DOM.mqttBadge) DOM.mqttBadge.className = 'badge inactive';
        if (DOM.espBadge) DOM.espBadge.className = 'badge inactive';
        showToast('❌ Error MQTT', 'error');
      });

      client.on('offline', () => {
        console.log('⚠️ MQTT Offline');
        state.mqttConnected = false;
        state.espOnline = false;
        updateConnectionUI('disconnected', 'Offline');
        if (DOM.mqttBadge) DOM.mqttBadge.className = 'badge inactive';
        if (DOM.espBadge) DOM.espBadge.className = 'badge inactive';
      });

      client.on('reconnect', () => {
        console.log('🔄 MQTT Reconnecting...');
        showToast('🔄 Mencoba reconnect...', 'warning');
      });

    } catch (e) {
      console.error('❌ Connection error:', e);
      showToast('❌ Gagal koneksi MQTT', 'error');
      setTimeout(initMQTT, 5000);
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
    
    if (state.turbStatus && DOM.turbStatus) {
      // Update turbidity status text
      const statusColors = {
        'SANGAT JERNIH': '#2ecc71',
        'JERNIH': '#2ecc71',
        'CUKUP JERNIH': '#f39c12',
        'AGAK KERUH': '#e67e22',
        'KERUH': '#e74c3c'
      };
      const turbStatusEl = document.querySelector('.metric-status[data-metric="turbidity"]');
      if (turbStatusEl) {
        turbStatusEl.textContent = state.turbStatus;
        turbStatusEl.style.color = statusColors[state.turbStatus] || '#2ecc71';
      }
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
    
    // 6. Update Charts
    updateCharts(state.ph, state.turbidity);
    
    // 7. Update Online Status
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
    const needReplace = state.filterNeedReplacement || false;
    const filterScore = state.health || state.filterScore || 0;
    
    // Tentukan status berdasarkan skor
    let statusText = state.filterStatus || '';
    let statusColor = state.filterStatusColor || '';
    let statusEmoji = state.filterStatusEmoji || '';
    
    if (!statusText) {
      if (needReplace || filterScore < 40) {
        statusText = 'GANTI';
        statusColor = 'RED';
        statusEmoji = '🔴';
      } else if (filterScore < 70) {
        statusText = 'CEK';
        statusColor = 'YELLOW';
        statusEmoji = '🟡';
      } else {
        statusText = 'NORMAL';
        statusColor = 'GREEN';
        statusEmoji = '🟢';
      }
    }
    
    // Map color ke CSS
    let ledClass = '';
    let textClass = '';
    
    switch(statusColor.toUpperCase()) {
      case 'GREEN':
        ledClass = 'led-green';
        textClass = 'text-filter-normal';
        break;
      case 'YELLOW':
        ledClass = 'led-yellow';
        textClass = 'text-filter-check';
        break;
      case 'RED':
        ledClass = 'led-red';
        textClass = 'text-filter-replace';
        break;
      default:
        ledClass = 'led-green';
        textClass = 'text-filter-normal';
    }
    
    if (DOM.filterReplaceStatus) {
      DOM.filterReplaceStatus.innerHTML = `
        <span class="status-led ${ledClass}"></span>
        <span class="${textClass}">${statusEmoji} ${statusText}</span>
        <span class="text-xs text-white/40 ml-1">(${filterScore.toFixed(0)}%)</span>
      `;
    }
    
    if (DOM.filterReplaceScore) {
      DOM.filterReplaceScore.textContent = filterScore.toFixed(0) + '%';
      if (filterScore < 40) {
        DOM.filterReplaceScore.className = 'text-sm font-mono text-[#FF2A54] font-bold';
      } else if (filterScore < 70) {
        DOM.filterReplaceScore.className = 'text-sm font-mono text-[#FFD700] font-bold';
      } else {
        DOM.filterReplaceScore.className = 'text-sm font-mono text-[#00FF66] font-bold';
      }
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
    
    if (isLowerBetter) {
      if (value <= maxSafe) {
        element.textContent = safeLabel;
        element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 uppercase tracking-wider';
      } else if (value <= maxSafe * 2) {
        element.textContent = warnLabel;
        element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 uppercase tracking-wider';
      } else {
        element.textContent = dangerLabel;
        element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF2A54]/15 text-[#FF2A54] border border-[#FF2A54]/30 uppercase tracking-wider animate-pulse';
      }
    } else {
      if (value >= minSafe && value <= maxSafe) {
        element.textContent = safeLabel;
        element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 uppercase tracking-wider';
      } else if (value < minSafe - 1 || value > maxSafe + 1) {
        element.textContent = dangerLabel;
        element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF2A54]/15 text-[#FF2A54] border border-[#FF2A54]/30 uppercase tracking-wider animate-pulse';
      } else {
        element.textContent = warnLabel;
        element.className = 'inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 uppercase tracking-wider';
      }
    }
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

  setInterval(() => {
    if (!state.mqttConnected && client) {
      console.log('🔄 Auto-reconnect triggered...');
      client.reconnect();
    }
  }, 30000);

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
        if (client) client.reconnect();
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
    
    initCharts();
    initMQTT();
  });

  // ==================== EXPOSE FOR DEBUG ====================
  window.debug = {
    state: state,
    client: client,
    MQTT_CONFIG: MQTT_CONFIG
  };

  console.log('🔧 Debug: Type "debug" in console to see state');

})();
