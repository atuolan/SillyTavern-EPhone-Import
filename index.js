/**
 * EPhone Chat Import Extension for SillyTavern
 * 從 EPhone-Vue 導入聊天記錄到 SillyTavern
 */

(function () {
  'use strict';

  const extensionName = 'ephone-import';
  const extensionFolderPath = `scripts/extensions/third-party/${extensionName}/`;

  // 擴展設置
  let settings = {
    autoConvertTimestamp: true,
    preserveMetadata: true,
    importImages: true,
  };

  /**
   * 初始化擴展
   */
  async function init() {
    console.log('[EPhone Import] 初始化擴展...');

    // 載入設置
    loadSettings();

    // 添加 UI
    addUI();

    // 註冊事件
    registerEvents();

    console.log('[EPhone Import] ✅ 擴展已載入');
  }

  /**
   * 載入設置
   */
  function loadSettings() {
    const savedSettings = localStorage.getItem('ephone_import_settings');
    if (savedSettings) {
      try {
        settings = { ...settings, ...JSON.parse(savedSettings) };
      } catch (e) {
        console.error('[EPhone Import] 載入設置失敗:', e);
      }
    }
  }

  /**
   * 保存設置
   */
  function saveSettings() {
    localStorage.setItem('ephone_import_settings', JSON.stringify(settings));
  }

  /**
   * 添加 UI 元素
   */
  function addUI() {
    // 在擴展設置中添加面板
    const settingsHtml = `
      <div id="ephone-import-settings">
        <div class="inline-drawer">
          <div class="inline-drawer-toggle inline-drawer-header">
            <b>📱 EPhone Chat Import</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
          </div>
          <div class="inline-drawer-content">
            <div class="ephone-import-container">
              <h3>從 EPhone-Vue 導入聊天記錄</h3>

              <div class="ephone-import-description">
                <p>📝 使用步驟：</p>
                <ol>
                  <li><strong>先選擇角色</strong> - 在 SillyTavern 中選擇或創建對應的角色</li>
                  <li>在 EPhone-Vue 中打開要導出的聊天</li>
                  <li>點擊右上角菜單 → 「導出到 SillyTavern」</li>
                  <li>下載 JSON 文件</li>
                  <li>點擊下方按鈕選擇文件導入</li>
                </ol>
                <p style="color: #f39c12; margin-top: 10px;">
                  ⚠️ 請確保已選擇角色，否則無法導入！
                </p>
              </div>

              <div class="ephone-import-actions">
                <button id="ephone-import-btn" class="menu_button">
                  <i class="fa-solid fa-file-import"></i>
                  選擇 EPhone 聊天文件
                </button>
              </div>

              <div class="ephone-import-settings">
                <h4>導入設置</h4>
                <label class="checkbox_label">
                  <input type="checkbox" id="ephone-auto-convert-timestamp" ${settings.autoConvertTimestamp ? 'checked' : ''} />
                  <span>自動轉換時間戳</span>
                </label>
                <label class="checkbox_label">
                  <input type="checkbox" id="ephone-preserve-metadata" ${settings.preserveMetadata ? 'checked' : ''} />
                  <span>保留 EPhone 元數據</span>
                </label>
                <label class="checkbox_label">
                  <input type="checkbox" id="ephone-import-images" ${settings.importImages ? 'checked' : ''} />
                  <span>導入圖片（如果有）</span>
                </label>
              </div>

              <div id="ephone-import-status" class="ephone-import-status"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    $('#extensions_settings2').append(settingsHtml);
  }

  /**
   * 註冊事件
   */
  function registerEvents() {
    // 導入按鈕
    $(document).on('click', '#ephone-import-btn', handleImportClick);

    // 設置變更
    $(document).on('change', '#ephone-auto-convert-timestamp', function () {
      settings.autoConvertTimestamp = $(this).is(':checked');
      saveSettings();
    });

    $(document).on('change', '#ephone-preserve-metadata', function () {
      settings.preserveMetadata = $(this).is(':checked');
      saveSettings();
    });

    $(document).on('change', '#ephone-import-images', function () {
      settings.importImages = $(this).is(':checked');
      saveSettings();
    });
  }

  /**
   * 處理導入按鈕點擊
   */
  function handleImportClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.multiple = false;

    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        showStatus('正在讀取文件...', 'info');
        const text = await file.text();
        const ephoneData = JSON.parse(text);

        // 驗證文件格式
        if (!validateEPhoneData(ephoneData)) {
          showStatus('❌ 無效的 EPhone 聊天文件格式', 'error');
          return;
        }

        // 轉換並導入
        await importEPhoneChat(ephoneData);
      } catch (error) {
        console.error('[EPhone Import] 導入失敗:', error);
        showStatus(`❌ 導入失敗: ${error.message}`, 'error');
      }
    };

    input.click();
  }

  /**
   * 驗證 EPhone 數據格式
   */
  function validateEPhoneData(data) {
    if (!data || typeof data !== 'object') {
      console.error('[EPhone Import] 數據不是對象');
      return false;
    }

    if (data.source !== 'EPhone-Vue') {
      console.error('[EPhone Import] 不是 EPhone-Vue 導出的文件');
      return false;
    }

    if (!data.characterName) {
      console.error('[EPhone Import] 缺少角色名稱');
      return false;
    }

    if (!Array.isArray(data.messages)) {
      console.error('[EPhone Import] 消息格式錯誤');
      return false;
    }

    return true;
  }

  /**
   * 導入 EPhone 聊天
   */
  async function importEPhoneChat(ephoneData) {
    showStatus(`正在導入 ${ephoneData.characterName} 的聊天記錄...`, 'info');

    try {
      // 轉換為 SillyTavern 格式
      const stChat = convertToSTFormat(ephoneData);

      // 獲取當前上下文
      const context = window.SillyTavern?.getContext?.();

      if (!context) {
        throw new Error('無法獲取 SillyTavern 上下文，請確保插件正確載入');
      }

      // 檢查是否有選中的角色
      const currentCharacter = context.name2 || context.characterId;

      if (!currentCharacter) {
        showStatus(
          '⚠️ 請先選擇一個角色！\n\n' + '1. 在角色列表中選擇或創建角色\n' + '2. 然後再導入聊天記錄',
          'warning',
        );
        return;
      }

      // 檢查角色名稱是否匹配
      const characterMatch = currentCharacter === ephoneData.characterName;

      if (!characterMatch) {
        const proceed = confirm(
          `當前選中的角色是：${currentCharacter}\n` +
            `導入的聊天來自：${ephoneData.characterName}\n\n` +
            `是否繼續導入到當前角色？`,
        );

        if (!proceed) {
          showStatus('❌ 已取消導入', 'info');
          return;
        }
      }

      // 保存聊天記錄（使用當前角色）
      await saveChatToST(stChat, currentCharacter);

      showStatus(
        `✅ 成功導入 ${stChat.messages.length} 條消息！\n` +
          `角色：${currentCharacter}\n` +
          `來源：${ephoneData.characterName}`,
        'success',
      );

      // 3秒後清除狀態
      setTimeout(() => {
        $('#ephone-import-status').fadeOut();
      }, 3000);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 轉換為 SillyTavern 格式
   */
  function convertToSTFormat(ephoneData) {
    // 🔥 將所有消息合併成一條 <phone> 格式的消息
    let phoneContent = '<phone>\n';

    ephoneData.messages.forEach(msg => {
      const sender = msg.role === 'user' ? '{{user}}' : '{{char}}';
      const timestamp = new Date(msg.timestamp).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      // 格式：{{char}}: 消息內容 // 2025/01/18 12:34
      phoneContent += `${sender}: ${msg.content} // ${timestamp}\n\n`;
    });

    phoneContent += '</phone>';

    // 創建單條消息
    const singleMessage = {
      name: ephoneData.characterName,
      is_user: false,
      is_system: false,
      send_date: Date.now(),
      mes: phoneContent,
      swipes: [],
      swipe_id: 0,
      swipe_info: [],
    };

    // 保留元數據
    if (settings.preserveMetadata) {
      singleMessage.extra = {
        ephone_import: true,
        ephone_character_id: ephoneData.characterId,
        ephone_message_count: ephoneData.messages.length,
        ephone_import_time: Date.now(),
      };
    }

    return {
      chat_metadata: {
        note_prompt: ephoneData.conversationSummary || '',
        note_interval: 0,
        ephone_import: {
          source: 'EPhone-Vue',
          import_time: Date.now(),
          original_character_id: ephoneData.characterId,
          is_group: ephoneData.isGroup,
          important_events: ephoneData.importantEvents || [],
        },
      },
      messages: [singleMessage], // 只有一條消息
    };
  }

  /**
   * 獲取 CSRF Token
   */
  function getCSRFToken() {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    return token || '';
  }

  /**
   * 檢查角色是否存在
   */
  async function checkCharacterExists(characterName) {
    try {
      // 使用 SillyTavern 的內部 API
      const context = window.SillyTavern?.getContext?.();
      if (context && context.characters) {
        return context.characters.some(char => char.name === characterName);
      }

      // 降級方案：使用 fetch
      const response = await fetch('/api/characters/all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken(),
        },
      });

      if (!response.ok) return false;

      const characters = await response.json();
      return characters.some(char => char.name === characterName);
    } catch (error) {
      console.error('[EPhone Import] 檢查角色失敗:', error);
      return false;
    }
  }

  /**
   * 從 EPhone 數據創建角色
   */
  async function createCharacterFromEPhone(ephoneData) {
    try {
      // 使用 SillyTavern 的內部 API（如果可用）
      if (window.SillyTavern?.getContext) {
        const context = window.SillyTavern.getContext();

        // 創建簡單的角色數據
        const characterData = {
          name: ephoneData.characterName,
          description: `從 EPhone-Vue 導入的角色\n\n${ephoneData.conversationSummary || ''}`,
          personality: '',
          scenario: '',
          first_mes: '你好！',
          mes_example: '',
          creator_notes: 'Imported from EPhone-Vue',
          tags: ['ephone-import'],
          avatar: 'default.png',
        };

        // 嘗試使用內部方法創建
        if (typeof context.createCharacter === 'function') {
          await context.createCharacter(characterData);
          console.log('[EPhone Import] ✅ 角色創建成功（內部 API）');
          return;
        }
      }

      // 降級方案：使用 fetch
      const response = await fetch('/api/characters/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken(),
        },
        body: JSON.stringify({
          name: ephoneData.characterName,
          description: `從 EPhone-Vue 導入的角色\n\n${ephoneData.conversationSummary || ''}`,
          personality: '',
          scenario: '',
          first_mes: '你好！',
          mes_example: '',
          creator_notes: 'Imported from EPhone-Vue',
          tags: ['ephone-import'],
        }),
      });

      if (!response.ok) {
        throw new Error('創建角色失敗');
      }

      console.log('[EPhone Import] ✅ 角色創建成功');
    } catch (error) {
      console.error('[EPhone Import] 創建角色失敗:', error);
      throw error;
    }
  }

  /**
   * 保存聊天到 SillyTavern
   */
  async function saveChatToST(chatData, characterName) {
    try {
      // 使用 SillyTavern 的內部 API
      const context = window.SillyTavern?.getContext?.();

      if (context && typeof context.saveChat === 'function') {
        // 將消息添加到當前聊天
        for (const message of chatData.messages) {
          context.chat.push(message);
        }

        // 保存聊天
        await context.saveChat();

        // 🔥 刷新聊天界面
        if (typeof context.reloadCurrentChat === 'function') {
          await context.reloadCurrentChat();
        } else if (typeof context.printMessages === 'function') {
          context.printMessages();
        } else {
          // 手動觸發重新渲染
          eventSource.emit('chatLoaded', { detail: { id: context.chatId } });
        }

        console.log('[EPhone Import] ✅ 聊天記錄保存成功（內部 API）');
        return;
      }

      // 降級方案：使用 fetch
      const response = await fetch('/api/chats/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken(),
        },
        body: JSON.stringify({
          ch_name: characterName,
          file_name: `EPhone_Import_${Date.now()}.jsonl`,
          chat: chatData.messages,
          metadata: chatData.chat_metadata,
        }),
      });

      if (!response.ok) {
        throw new Error(`保存失敗: ${response.statusText}`);
      }

      console.log('[EPhone Import] ✅ 聊天記錄保存成功');
    } catch (error) {
      console.error('[EPhone Import] 保存聊天失敗:', error);
      throw error;
    }
  }

  /**
   * 顯示狀態消息
   */
  function showStatus(message, type = 'info') {
    const $status = $('#ephone-import-status');
    $status.removeClass('info success error warning');
    $status.addClass(type);
    $status.html(message.replace(/\n/g, '<br>'));
    $status.fadeIn();
  }

  // 當 jQuery 準備好時初始化
  jQuery(async () => {
    await init();
  });
})();
