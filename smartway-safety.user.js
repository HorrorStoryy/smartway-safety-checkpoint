// ==UserScript==
// @name         Smartway Safety Checkpoint
// @namespace    https://smartway.today/
// @version      1.0
// @description  Предохранитель для проверки данных перед покупкой билетов
// @author       Smartway
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/HorrorStoryy/smartway-safety-checkpoint/main/smartway-safety.meta.js
// @downloadURL  https://raw.githubusercontent.com/HorrorStoryy/smartway-safety-checkpoint/main/smartway-safety.user.js
// ==/UserScript==

(function() {
    'use strict';

    // === ЗАМЕНА chrome.storage.local ===
    function getStorage(keys, callback) {
        var result = {};
        if (typeof keys === 'string') keys = [keys];
        for (var i = 0; i < keys.length; i++) {
            result[keys[i]] = GM_getValue(keys[i], null);
        }
        if (callback) callback(result);
        return result;
    }

    function setStorage(obj, callback) {
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
            GM_setValue(keys[i], obj[keys[i]]);
        }
        if (callback) callback();
    }

    // === КОНФИГУРАЦИЯ ЦЕЛЕВЫХ КНОПОК ===
    var TARGETS = [
        { domain: 'e-traffic.ru', selector: '.btn-order, .btn-buy, button[type="submit"], .order-button' },
        { domain: 'avtovokzaly.ru', selector: '.btn-buy, .btn-success, .ticket-btn, .button-pay, .pay-btn, .js-buy-btn, [class*="buy-button"], [class*="pay-button"], .btn-pay, button' },
        { domain: 'tutu.ru', selector: '.order-button, button.b-button, [class*="SubmitButton"]' },
        { domain: 'aeroexpress.ru', selector: 'button[type="submit"], .buy-button, [class*="button"]' },
        { domain: 'rfbus.ru', selector: '.btn-booking, .btn-pay, [class*="submit"], .button-booking' },
        { domain: 'avperm.ru', selector: '.btn-buy, .btn-primary, button[type="submit"], .js-buy-ticket, .buy-btn, .btn-order, .js-order-btn, .button, a' },
        { domain: 'krasavtovokzal.ru', selector: '.btn, button, .js-buy, .order-btn, .js-order-ticket' },
        { domain: 'avtoperm.ru', selector: '.btn-buy, .btn-primary, button[type="submit"]' },
        { domain: 'avtovokzal-irkutsk.ru', selector: '.btn-buy, #buy-btn, button' },
        { domain: 'unitiki.com', selector: 'button, [type="submit"], .btn-pay, .submit-button' },
        { domain: 'ros-bilet.ru', selector: '.btn, button, .buy-btn, [class*="pay"], .pay-btn' },
        { domain: 'smarttravel.ru', selector: 'button, .v-btn, .btn-primary, .btn, [role="button"]' },
        { domain: 'smart-mobility.ru', selector: 'button, .v-btn, .btn-order, .btn-primary, [role="button"]' },
        { domain: 'aviasales.ru', selector: "[data-test-id='button']" },
        { domain: 'yandex.ru', selector: '.Button_purchase' }
    ];

    var KEYWORDS = ['оформить билет', 'оформить', 'оплатить', 'купить', 'забронировать', 'далее', 'подтвердить', 'pay', 'order', 'продолжить', 'бронировать', 'купить за', 'оплатить картой', 'перейти к оплате'];

    var isInternalClick = false;

    // === СОСТОЯНИЕ ПРИЛОЖЕНИЯ ===
    var appState = {
        hasData: false,
        widgetVisible: false
    };

    function updateLocalState(data) {
        if (data.referenceData !== undefined) {
            appState.hasData = !!data.referenceData && data.referenceData.trim().length > 0;
        }
        if (data.widgetVisible !== undefined) {
            appState.widgetVisible = !!data.widgetVisible;
        }
    }

    var MONTH_MAP = {
        'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04', 'май': '05', 'мая': '05', 'июн': '06',
        'июл': '07', 'авг': '08', 'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12'
    };

    // === ЧЕК-ЛИСТЫ ДЛЯ БО SMARTWAY ===
    var BO_CHECKLISTS = {
        transfer: {
            title: 'Трансфер',
            icon: '\uD83D\uDE95',
            items: [
                'Номер заказа',
                'ФИО сотрудника (Если однофамильцы - смотрим дату рождения и паспорт)',
                'Аналитики',
                'Откуда отправление, Дата и время подачи авто',
                'Куда прибывает, Дата и время приезда авто',
                'Встреча с табличкой',
                'Цена'
            ]
        },
        custom: {
            title: 'Кастомная услуга',
            icon: '\u2699\uFE0F',
            items: [
                'Название услуги',
                'ФИО сотрудника (Если однофамильцы - смотрим дату рождения и паспорт)',
                'Аналитики',
                'Тип оплаты',
                'Дата и время начала услуги',
                'Дата и время окончания услуги',
                'Цена (Стоимость/Наценка Smartway)'
            ]
        },
        vip: {
            title: 'VIP-зал',
            icon: '\uD83D\uDECB\uFE0F',
            items: [
                'Название услуги',
                'ФИО сотрудника (Если однофамильцы - смотрим дату рождения и паспорт)',
                'Аналитики',
                'Направление и Тип перелёта',
                'Место вылета, Дата и время',
                'Место прилёта, Дата и время',
                'Цена (Стоимость/Наценка Smartway)',
                'С НДС (Россия)/Без НДС (зарубеж)'
            ]
        },
        bus: {
            title: 'Автобусный билет',
            icon: '\uD83D\uDE8C',
            items: [
                'Название поездки',
                'ФИО сотрудника (Если однофамильцы - смотрим дату рождения и паспорт)',
                'Аналитики',
                'Тип багажа',
                'Пункт отправления, Дата и время',
                'Пункт прибытия, Дата и время',
                'Цена'
            ]
        }
    };

    // === ПРОВЕРКА: ФИНАЛЬНЫЙ ЭТАП ОФОРМЛЕНИЯ ===
    function isFinalCheckoutStage(buttonText, hostname) {
        var url = window.location.href.toLowerCase();
        var pageText = (document.body.innerText || '').toLowerCase();
        var passwordInputs = document.querySelectorAll('input[type="password"]');
        var hasVisiblePassword = false;
        for (var p = 0; p < passwordInputs.length; p++) {
            if (passwordInputs[p].offsetParent !== null || passwordInputs[p].offsetWidth > 0) {
                hasVisiblePassword = true;
                break;
            }
        }
        if (hasVisiblePassword) return false;

        if (hostname.indexOf('smart-mobility.ru') !== -1 || hostname.indexOf('smarttravel.ru') !== -1) {
            var isAction = false;
            for (var k = 0; k < KEYWORDS.length; k++) {
                if (buttonText.indexOf(KEYWORDS[k]) !== -1) { isAction = true; break; }
            }
            if (isAction) return true;
        }

        var isSearchPage = url.indexOf('/search') !== -1 || url.indexOf('/results') !== -1 || url.indexOf('/rasp') !== -1 || url.indexOf('/shedule') !== -1 || url.indexOf('/selection') !== -1;
        if (isSearchPage) return false;

        var criticalSelectors = [
            'input[name*="surname"]', 'input[name*="lastname"]', 'input[name*="fio"]',
            'input[placeholder*="\u0424\u0430\u043c\u0438\u043b\u0438\u044f"]',
            'input[placeholder*="\u0418\u043c\u044f"]',
            'input[placeholder*="\u041f\u0430\u0441\u043f\u043e\u0440\u0442"]',
            'input[placeholder*="\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442"]',
            'input[aria-label*="\u0424\u0430\u043c\u0438\u043b\u0438\u044f"]',
            'input[data-vv-name*="passenger"]',
            'input[name*="passenger"]', 'input[id*="pas"]', 'input[id*="doc"]',
            'input[id*="passenger"]', 'input[name*="doc"]'
        ];
        var allInputs = document.querySelectorAll(criticalSelectors.join(', '));
        var hasVisibleInputs = false;
        for (var ci = 0; ci < allInputs.length; ci++) {
            if (allInputs[ci].offsetParent !== null || allInputs[ci].offsetWidth > 0) {
                hasVisibleInputs = true;
                break;
            }
        }

        var markers = ['\u043f\u0430\u0441\u0441\u0430\u0436\u0438\u0440', '\u0444\u0430\u043c\u0438\u043b\u0438\u044f', '\u043f\u0430\u0441\u043f\u043e\u0440\u0442', '\u043d\u043e\u043c\u0435\u0440 \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u0430', '\u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u0430\u0441\u0441\u0430\u0436\u0438\u0440\u0430', '\u0441\u0432\u0435\u0434\u0435\u043d\u0438\u044f \u043e \u043f\u0430\u0441\u0441\u0430\u0436\u0438\u0440\u0435'];
        var markersFound = 0;
        for (var mi = 0; mi < markers.length; mi++) {
            if (pageText.indexOf(markers[mi]) !== -1) markersFound++;
        }

        if (hostname.indexOf('avtovokzaly.ru') !== -1) {
            var isCheckoutPath = url.indexOf('checkout') !== -1 || url.indexOf('order') !== -1 || url.indexOf('buy') !== -1 || url.indexOf('passenger') !== -1;
            return hasVisibleInputs || (isCheckoutPath && markersFound >= 1);
        }
        if (hostname.indexOf('e-traffic.ru') !== -1) return hasVisibleInputs;
        if (hostname.indexOf('tutu.ru') !== -1) return hasVisibleInputs || markersFound >= 2;
        if (hostname.indexOf('avperm.ru') !== -1) {
            return buttonText.indexOf('\u043a\u0443\u043f\u0438\u0442\u044c \u0431\u0438\u043b\u0435\u0442') !== -1 || buttonText.indexOf('\u043f\u0435\u0440\u0435\u0439\u0442\u0438 \u043a \u043e\u043f\u043b\u0430\u0442\u0435') !== -1;
        }
        if (hostname.indexOf('unitiki.com') !== -1) {
            return buttonText.indexOf('\u043a\u0443\u043f\u0438\u0442\u044c \u0431\u0438\u043b\u0435\u0442') !== -1;
        }
        var isBookingUrl = url.indexOf('buy') !== -1 || url.indexOf('booking') !== -1 || url.indexOf('order') !== -1 || url.indexOf('pay') !== -1 || url.indexOf('ticket') !== -1;
        return hasVisibleInputs || (isBookingUrl && markersFound >= 1);
    }

    // === ФОРМАТИРОВАНИЕ ДАТ ===
    function enrichTextWithFormattedDates(text) {
        if (!text) return '';
        var dateRegex = /(\d{1,2})[\s.]([а-яёА-ЯЁ]{3,})[\s.](\d{4})(?:\sг.?)?/g;
        return text.replace(dateRegex, function(match, day, month, year) {
            var monthLower = month.toLowerCase();
            var monthNum = MONTH_MAP[monthLower];
            if (!monthNum) {
                var keys = Object.keys(MONTH_MAP);
                for (var i = 0; i < keys.length; i++) {
                    if (monthLower.indexOf(keys[i]) === 0) { monthNum = MONTH_MAP[keys[i]]; break; }
                }
            }
            if (monthNum) {
                var dayFormatted = day.padStart(2, '0');
                return match + ' (' + dayFormatted + '.' + monthNum + '.' + year + ')';
            }
            return match;
        });
    }

    // === ESCAPE HTML ===
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // === ПЛАВАЮЩИЙ ВИДЖЕТ ===
    function updateFloatingWidget(text, isVisible) {
        if (isVisible === undefined) isVisible = true;
        var widgetRoot = document.getElementById('smartway-info-root');
        if (!text || isVisible === false) {
            if (widgetRoot) widgetRoot.remove();
            return;
        }
        var enrichedText = enrichTextWithFormattedDates(text);
        if (!widgetRoot) {
            widgetRoot = document.createElement('div');
            widgetRoot.id = 'smartway-info-root';
            document.body.appendChild(widgetRoot);
            var shadow = widgetRoot.attachShadow({ mode: 'open' });
            var style = document.createElement('style');
            style.textContent = [
                '.info-card { position: fixed; bottom: 20px; right: 20px; width: 360px; background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 14px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); z-index: 2147483647; font-family: system-ui, -apple-system, sans-serif; border: 1px solid #334155; }',
                '.header { font-weight: 800; margin-bottom: 10px; color: #38bdf8; display: flex; justify-content: space-between; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }',
                '.content { font-family: "JetBrains Mono", "Fira Code", monospace; background: #000000; padding: 12px; border-radius: 8px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; font-size: 14px; color: #ffffff; border: 1px solid #1e293b; line-height: 1.6; }',
                '.date-tag { color: #facc15; font-weight: bold; text-decoration: underline; }',
                '.close { cursor: pointer; opacity: 0.6; font-size: 18px; line-height: 1; padding: 0 5px; } .close:hover { opacity: 1; color: #ef4444; }'
            ].join('\n');
            var container = document.createElement('div');
            container.className = 'info-card';
            container.innerHTML = '<div class="header"><span>\u0421\u043f\u0440\u0430\u0432\u043a\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0430</span><span class="close" id="close-widget">\u00d7</span></div><div class="content" id="widget-text"></div>';
            shadow.appendChild(style);
            shadow.appendChild(container);
            shadow.getElementById('close-widget').onclick = function() {
                setStorage({ widgetVisible: false });
            };
        }
        var textElement = widgetRoot.shadowRoot.getElementById('widget-text');
        if (textElement) {
            textElement.innerHTML = escapeHtml(enrichedText).replace(/\((.*?)\)/g, '<span class="date-tag">($1)</span>');
        }
    }

    // === МОДАЛЬНОЕ ОКНО ПЕРЕД ПОКУПКОЙ ===
    function showSafetyModal(originalElement) {
        if (document.getElementById('smartway-safety-root')) return;
        var refData = GM_getValue('referenceData', '\u0414\u0410\u041d\u041d\u042b\u0415 \u041d\u0415 \u0417\u0410\u0425\u0412\u0410\u0427\u0415\u041d\u042b');
        var referenceText = enrichTextWithFormattedDates(refData);
        var root = document.createElement('div');
        root.id = 'smartway-safety-root';
        document.body.appendChild(root);
        var shadow = root.attachShadow({ mode: 'open' });
        var style = document.createElement('style');
        style.textContent = [
            '.overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: transparent; display: flex; align-items: stretch; justify-content: flex-end; z-index: 2147483647; font-family: system-ui, sans-serif; pointer-events: none; }',
            '.modal { background: #ffffff; width: 450px; padding: 30px; height: 100vh; box-shadow: -10px 0 30px rgba(0,0,0,0.15); color: #1e293b; border-left: 1px solid #e2e8f0; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1); pointer-events: auto; }',
            '@keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }',
            '.modal-scrollable { overflow-y: auto; flex-grow: 1; padding-right: 5px; margin-bottom: 20px; }',
            'h2 { margin: 0 0 20px; font-size: 18px; text-transform: uppercase; color: #ef4444; font-weight: 900; text-align: center; }',
            '.reference-box { background: #f8fafc; border: 2px solid #cbd5e1; border-radius: 12px; padding: 16px; font-family: monospace; font-size: 14px; white-space: pre-wrap; margin-bottom: 20px; max-height: 200px; overflow-y: auto; color: #000000; line-height: 1.5; }',
            '.date-highlight { background: #fef9c3; color: #854d0e; padding: 2px 6px; border-radius: 4px; font-weight: bold; }',
            '.checklist { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }',
            '.check-item { display: flex; align-items: center; cursor: pointer; font-size: 14px; padding: 10px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; transition: background 0.15s; }',
            '.check-item:hover { background: #f1f5f9; }',
            '.check-item.checked { border-color: #10b981; background: #f0fdf4; }',
            '.check-item input { width: 20px; height: 20px; margin-right: 14px; cursor: pointer; accent-color: #10b981; }',
            '.actions { display: flex; gap: 12px; margin-top: auto; }',
            '.btn { flex: 1; padding: 14px; border-radius: 12px; border: none; font-weight: 800; cursor: pointer; font-size: 14px; text-transform: uppercase; transition: all 0.2s; }',
            '.btn-pay { background: #10b981; color: #fff; }',
            '.btn-pay:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; }',
            '.btn-cancel { background: #fff; border: 2px solid #e2e8f0; color: #64748b; }',
            '.btn-cancel:hover { background: #f1f5f9; }'
        ].join('\n');
        var container = document.createElement('div');
        container.className = 'overlay';
        var htmlContent = escapeHtml(referenceText).replace(/\((.*?)\)/g, '<span class="date-highlight">($1)</span>');
        container.innerHTML = '<div class="modal"><div class="modal-scrollable"><h2>\u0421\u0432\u0435\u0440\u043a\u0430 \u043f\u0435\u0440\u0435\u0434 \u043e\u043f\u043b\u0430\u0442\u043e\u0439</h2><div class="reference-box">' + htmlContent + '</div><div class="checklist"><label class="check-item"><input type="checkbox" class="safeguard"><span>\u0414\u0430\u0442\u0430 \u043f\u043e\u0435\u0437\u0434\u043a\u0438</span></label><label class="check-item"><input type="checkbox" class="safeguard"><span>\u0412\u0440\u0435\u043c\u044f \u043f\u043e\u0435\u0437\u0434\u043a\u0438</span></label><label class="check-item"><input type="checkbox" class="safeguard"><span>\u0413\u043e\u0440\u043e\u0434 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u0438 \u0430\u0434\u0440\u0435\u0441</span></label><label class="check-item"><input type="checkbox" class="safeguard"><span>\u0413\u043e\u0440\u043e\u0434 \u043f\u0440\u0438\u0431\u044b\u0442\u0438\u044f \u0438 \u0430\u0434\u0440\u0435\u0441</span></label><label class="check-item"><input type="checkbox" class="safeguard"><span>\u0424\u0418\u041e \u0438 \u043f\u0430\u0441\u043f\u043e\u0440\u0442 \u043f\u0430\u0441\u0441\u0430\u0436\u0438\u0440\u0430</span></label><label class="check-item"><input type="checkbox" class="safeguard"><span>\u041d\u0430\u043b\u0438\u0447\u0438\u0435 \u0431\u0430\u0433\u0430\u0436\u0430</span></label></div></div><div class="actions"><button class="btn btn-cancel" id="cancel">\u0418\u0441\u043f\u0440\u0430\u0432\u0438\u0442\u044c</button><button class="btn btn-pay" id="confirm" disabled>\u041e\u041f\u041b\u0410\u0422\u0418\u0422\u042c</button></div></div>';
        shadow.appendChild(style);
        shadow.appendChild(container);
        var checkboxes = shadow.querySelectorAll('.safeguard');
        var confirmBtn = shadow.getElementById('confirm');
        var cancelBtn = shadow.getElementById('cancel');
        for (var i = 0; i < checkboxes.length; i++) {
            checkboxes[i].onchange = function() {
                this.closest('.check-item').classList.toggle('checked', this.checked);
                var allChecked = true;
                for (var j = 0; j < checkboxes.length; j++) {
                    if (!checkboxes[j].checked) { allChecked = false; break; }
                }
                confirmBtn.disabled = !allChecked;
            };
        }
        cancelBtn.onclick = function() { root.remove(); };
        confirmBtn.onclick = function() {
            isInternalClick = true;
            var triggerClick = function(el) {
                var events = ['mousedown', 'mouseup', 'click'];
                for (var e = 0; e < events.length; e++) {
                    el.dispatchEvent(new MouseEvent(events[e], { bubbles: true, cancelable: true, view: window }));
                }
            };
            var realBtn = originalElement.closest('button, a') || originalElement;
            triggerClick(realBtn);
            isInternalClick = false;
            root.remove();
        };
    }

    // === МОДАЛЬНОЕ ОКНО ДЛЯ БО SMARTWAY ===
    function showBoServiceSelectorModal(originalBtn) {
        if (document.getElementById('smartway-bo-root')) return;
        var root = document.createElement('div');
        root.id = 'smartway-bo-root';
        document.body.appendChild(root);
        var shadow = root.attachShadow({ mode: 'open' });
        var style = document.createElement('style');
        style.textContent = [
            '.overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.4); display: flex; align-items: center; justify-content: center; z-index: 2147483647; font-family: system-ui, -apple-system, sans-serif; pointer-events: none; }',
            '.modal { background: #ffffff; border-radius: 24px; width: 500px; padding: 35px; box-shadow: 0 30px 60px -12px rgba(0,0,0,0.4); color: #1e293b; border: 1px solid #e2e8f0; animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1); pointer-events: auto; }',
            '.overlay.sidebar-mode { justify-content: flex-end; align-items: stretch; background: transparent; }',
            '.overlay.sidebar-mode .modal { width: 420px; height: 100vh; border-radius: 24px 0 0 24px; margin: 0; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1); border-right: none; border-top: none; border-bottom: none; }',
            '@keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }',
            '@keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }',
            'h2 { margin: 0 0 10px; font-size: 20px; font-weight: 800; text-align: center; color: #0f172a; }',
            'p.subtitle { margin: 0 0 25px; text-align: center; color: #64748b; font-size: 14px; }',
            '.services-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; }',
            '.service-btn { background: #f8fafc; border: 2px solid #e2e8f0; padding: 20px 15px; border-radius: 16px; cursor: pointer; text-align: center; transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; gap: 10px; }',
            '.service-btn:hover { background: #f1f5f9; border-color: #cbd5e1; transform: translateY(-2px); }',
            '.service-icon { font-size: 32px; }',
            '.service-name { font-weight: 700; color: #334155; font-size: 14px; }',
            '.checklist { margin-bottom: 25px; display: flex; flex-direction: column; gap: 10px; }',
            '.check-item { display: flex; align-items: center; padding: 12px 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; cursor: pointer; transition: background 0.15s; }',
            '.check-item:hover { background: #f1f5f9; }',
            '.check-item.checked { border-color: #10b981; background: #f0fdf4; }',
            '.check-item input { width: 20px; height: 20px; margin-right: 15px; cursor: pointer; accent-color: #10b981; }',
            '.check-item span { font-weight: 600; font-size: 14px; color: #334155; text-align: left; }',
            '.actions { display: flex; gap: 12px; }',
            '.btn { flex: 1; padding: 14px; border-radius: 12px; border: none; font-weight: 800; cursor: pointer; font-size: 14px; text-transform: uppercase; transition: all 0.2s; }',
            '.btn-submit { background: #10b981; color: #ffffff; }',
            '.btn-submit:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; }',
            '.btn-cancel { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }',
            '.btn-cancel:hover { background: #e2e8f0; }'
        ].join('\n');
        var container = document.createElement('div');
        container.className = 'overlay';
        container.id = 'bo-overlay-container';
        container.innerHTML = '<div class="modal" id="bo-modal-content"><h2>\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0443\u0441\u043b\u0443\u0433\u0438 \u0432 \u0411\u041e</h2><p class="subtitle">\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0432\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043f \u0441\u043e\u0437\u0434\u0430\u0432\u0430\u0435\u043c\u043e\u0439 \u0443\u0441\u043b\u0443\u0433\u0438:</p><div class="services-grid"><div class="service-btn" data-service="transfer"><span class="service-icon">\uD83D\uDE95</span><span class="service-name">\u0422\u0440\u0430\u043d\u0441\u0444\u0435\u0440</span></div><div class="service-btn" data-service="custom"><span class="service-icon">\u2699\uFE0F</span><span class="service-name">\u041a\u0430\u0441\u0442\u043e\u043c\u043d\u0430\u044f \u0443\u0441\u043b\u0443\u0433\u0430</span></div><div class="service-btn" data-service="vip"><span class="service-icon">\uD83D\uDECB\uFE0F</span><span class="service-name">VIP-\u0437\u0430\u043b</span></div><div class="service-btn" data-service="bus"><span class="service-icon">\uD83D\uDE8C</span><span class="service-name">\u0410\u0432\u0442\u043e\u0431\u0443\u0441\u043d\u044b\u0439 \u0431\u0438\u043b\u0435\u0442</span></div></div><div class="actions"><button class="btn btn-cancel" id="cancel-selector">\u041e\u0442\u043c\u0435\u043d\u0430</button></div></div>';
        shadow.appendChild(style);
        shadow.appendChild(container);
        shadow.getElementById('cancel-selector').onclick = function() { root.remove(); };
        var serviceButtons = shadow.querySelectorAll('.service-btn');
        for (var i = 0; i < serviceButtons.length; i++) {
            serviceButtons[i].onclick = function() {
                var selectedServiceKey = this.getAttribute('data-service');
                renderBoChecklist(shadow, selectedServiceKey, originalBtn, root);
            };
        }
    }

    function renderBoChecklist(shadow, serviceKey, originalBtn, rootNode) {
        var serviceInfo = BO_CHECKLISTS[serviceKey];
        if (!serviceInfo) return;
        var overlayContainer = shadow.getElementById('bo-overlay-container');
        var modalContainer = shadow.getElementById('bo-modal-content');
        if (!overlayContainer || !modalContainer) return;
        overlayContainer.classList.add('sidebar-mode');
        var checklistItemsHtml = '';
        for (var i = 0; i < serviceInfo.items.length; i++) {
            checklistItemsHtml += '<label class="check-item" data-idx="' + i + '"><input type="checkbox" class="bo-safeguard"><span>' + escapeHtml(serviceInfo.items[i]) + '</span></label>';
        }
        modalContainer.innerHTML = '<div><h2 style="text-align: left; margin-top: 10px;">\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430: ' + escapeHtml(serviceInfo.title) + '</h2><p class="subtitle" style="text-align: left; margin-bottom: 25px;">\u0421\u0432\u0435\u0440\u044c\u0442\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u0441 \u0444\u043e\u0440\u043c\u043e\u0439 \u0441\u043b\u0435\u0432\u0430:</p><div class="checklist">' + checklistItemsHtml + '</div></div><div class="actions"><button class="btn btn-cancel" id="back-to-selector">\u041d\u0430\u0437\u0430\u0434</button><button class="btn btn-submit" id="confirm-bo" disabled>\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437</button></div>';
        var checkboxes = shadow.querySelectorAll('.bo-safeguard');
        var confirmBtn = shadow.getElementById('confirm-bo');
        var backBtn = shadow.getElementById('back-to-selector');
        for (var i = 0; i < checkboxes.length; i++) {
            checkboxes[i].onchange = function() {
                this.closest('.check-item').classList.toggle('checked', this.checked);
                var allChecked = true;
                for (var j = 0; j < checkboxes.length; j++) {
                    if (!checkboxes[j].checked) { allChecked = false; break; }
                }
                confirmBtn.disabled = !allChecked;
            };
        }
        backBtn.onclick = function() {
            modalContainer.remove();
            rootNode.remove();
            showBoServiceSelectorModal(originalBtn);
        };
        confirmBtn.onclick = function() {
            isInternalClick = true;
            var triggerClick = function(el) {
                var events = ['mousedown', 'mouseup', 'click'];
                for (var e = 0; e < events.length; e++) {
                    el.dispatchEvent(new MouseEvent(events[e], { bubbles: true, cancelable: true, view: window }));
                }
            };
            var realBtn = originalBtn.closest('button, a, input') || originalBtn;
            triggerClick(realBtn);
            isInternalClick = false;
            rootNode.remove();
        };
    }

    // === ПОИСК КНОПКИ ОПЛАТЫ ===
    function findPayButton(element) {
        if (!element || element === document) return null;
        var btn = element.closest("button, a, [role='button'], .v-btn, .btn, .button, .btn-pay, .ticket-btn, .button-pay, [class*='button'], [class*='btn']");
        if (!btn) return null;
        var text = (btn.innerText || btn.textContent || btn.value || '').toLowerCase().replace(/\s+/g, ' ').trim();
        var isMatch = false;
        for (var i = 0; i < KEYWORDS.length; i++) {
            if (text.indexOf(KEYWORDS[i]) !== -1) { isMatch = true; break; }
        }
        if (!isMatch && /купить\s+за/i.test(text)) isMatch = true;
        if (isMatch) {
            var href = btn.getAttribute('href');
            if (href && href.indexOf('#') !== 0 && href.indexOf('javascript:') !== 0 && !isFinalCheckoutStage(text, window.location.hostname)) {
                return null;
            }
            return btn;
        }
        return null;
    }

    // === ГЛАВНЫЙ ПЕРЕХВАТЧИК КЛИКОВ ===
    document.addEventListener('click', function(e) {
        if (isInternalClick) return;
        var isBoSmartway = window.location.hostname === 'bo.smartway.today';
        var clickedButton = e.target.closest('button, a, [role="button"], input[type="button"], input[type="submit"]');
        if (isBoSmartway && clickedButton) {
            var buttonText = (clickedButton.innerText || clickedButton.textContent || clickedButton.value || '').toLowerCase().trim();
            if (buttonText === '\u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437' || buttonText === '\u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0443\u0441\u043b\u0443\u0433\u0443') {
                var pageText = (document.body.innerText || '').toLowerCase();
                var hasPriceField = pageText.indexOf('\u0446\u0435\u043d\u0430') !== -1 || pageText.indexOf('\u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c') !== -1;
                var allInputs = document.querySelectorAll('input, select');
                var visibleInputs = [];
                for (var vi = 0; vi < allInputs.length; vi++) {
                    var type = (allInputs[vi].type || '').toLowerCase();
                    if (type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'checkbox' && type !== 'radio' && allInputs[vi].offsetParent !== null) {
                        visibleInputs.push(allInputs[vi]);
                    }
                }
                var isFormVisible = hasPriceField && visibleInputs.length > 0;
                if (isFormVisible) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    showBoServiceSelectorModal(clickedButton);
                    return;
                }
            }
        }
        if (!appState.hasData || !appState.widgetVisible) return;
        var tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            var type = (e.target.type || '').toLowerCase();
            if (type !== 'submit' && type !== 'button' && type !== 'reset') return;
        }
        var currentHost = window.location.hostname;
        var targetConfig = null;
        for (var t = 0; t < TARGETS.length; t++) {
            if (currentHost.indexOf(TARGETS[t].domain) !== -1) { targetConfig = TARGETS[t]; break; }
        }
        if (!targetConfig) return;
        var payButton = findPayButton(e.target);
        if (!payButton) {
            var closest = e.target.closest(targetConfig.selector);
            if (closest) payButton = findPayButton(closest) || closest;
        }
        if (payButton) {
            var btnText = (payButton.innerText || '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (!isFinalCheckoutStage(btnText, currentHost)) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            showSafetyModal(payButton);
        }
    }, true);

    // === ГОРЯЧИЕ КЛАВИШИ Alt+C ===
    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.code === 'KeyC') {
            var selection = window.getSelection().toString().trim();
            if (selection) {
                setStorage({ referenceData: selection, widgetVisible: true });
            }
        }
    });

    // === ИНИЦИАЛИЗАЦИЯ ===
    var initialData = getStorage(['referenceData', 'widgetVisible']);
    updateLocalState(initialData);
    if (initialData.referenceData) {
        updateFloatingWidget(initialData.referenceData, initialData.widgetVisible);
    }

    // === СИНХРОНИЗАЦИЯ МЕЖДУ ВКЛАДКАМИ ===
    GM_addValueChangeListener('referenceData', function(name, oldVal, newVal, remote) {
        appState.hasData = !!newVal && newVal.trim().length > 0;
        var widgetVisible = GM_getValue('widgetVisible', false);
        updateFloatingWidget(newVal, widgetVisible);
    });

    GM_addValueChangeListener('widgetVisible', function(name, oldVal, newVal, remote) {
        appState.widgetVisible = !!newVal;
        var refData = GM_getValue('referenceData', null);
        if (refData) updateFloatingWidget(refData, newVal);
    });

    console.log('[Safety Checkpoint] \u0421\u043a\u0440\u0438\u043f\u0442 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d, \u0432\u0435\u0440\u0441\u0438\u044f 1.0');

})();