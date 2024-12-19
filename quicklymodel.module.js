// 使用: const createModule = new Function('return ' + factoryCode)();
// const api = createQuicklyModel({
//     // 配置选项
//     debug: true,
//     // ... 其他选项
// });
// ==模块定义==
const createQuicklyModel = (function () {
    return function (options = {}) {
    // API命名空间
    const config = {
        debug: false,
    };
    Object.assign(config, options);
    const api = {
        version: '1.0.0',
        factory: null,
        apiLog: null,
        dom: {
            query: { // DOM查询相关
                $: null,
                $$: null
            },
            iframe: {}, // iframe操作相关
            createElement: {}, // createElement增强
            waitElement: {}, // waitElement实现
        },      
        event: {
            urlChange: {}, // URL变化监听
            domContentLoaded: {}, // DOM加载完成事件
            addEventListener: {}, // 事件监听器增强
            getDbclickAPI: {}, // 元素双击
            message: {}, // 消息
        },    
        net: {
            xhr: {}, // XMLHttpRequest增强
            fetch: {}, // fetch增强
            dyncFileLoad: {}, // 动态文件加载
        },      // 网络请求相关
        utils: {
            security: {},
            type: {}
        },
        animate: {
            background: {}, // 背景动画
            color: {}, // 颜色动画
            scan: {} // 扫描动画
        },  
        data: {}      // 数据处理
    };

    // ==工具函数模块==
    function utilsApiInit() {
        const api_ = api;
        api.utils = {
            createApiFactory: function () {
                const api = {
                    subscribeMap: new Map(),
                    globalOptionsMap: new Map(),
                    setGolbalOptions: function (name, options) {
                        if (![undefined, null].includes(options?.modify)) {
                            options.modify = Array.isArray(options.modify) ? options.modify : [options.modify];
                        }
                        const defaultOptions = {
                            modify: [],
                        };
                        this.globalOptionsMap.set(name, Object.assign({}, defaultOptions, options));
                    },
                    subscribe: function (name, callback, options = {}) {
                        if (typeof name !== 'string') throw new TypeError('Name must be a string');
                        if (typeof callback !== 'function') throw new TypeError('Callback must be a function');
                        if (options && (typeof options !== 'object' || Array.isArray(options))) throw new TypeError('Options must be an object');
                        const defaultOptions = {
                            once: false,
                            async: false,
                            stopPropagation: false,
                            weight: 1,
                            extras: {},
                            failCallback: null,
                            successCallback: null,
                            maxCalls: Infinity,
                            debounceTime: 0,
                            uniqueId: null,
                            throttleTime: 0,
                            condition: null,
                            uniqueMode: 'replace',
                            timeout: 0,
                            noParams: false,
                            context: null,
                            modify: [],
                            limit: Infinity,
                            globalOptions: this.globalOptionsMap.get(name)
                        };
                        options = { ...defaultOptions, ...options };
                        const globalOptions = options.globalOptions;
                        if (!Array.isArray(options.modify)) {
                            options.modify = [options.modify];
                        }
                        if (options.modify.some((item) => isNaN(item))) {
                            throw new TypeError('modify must be a number');
                        }

                        const commonWrapper = function (callback) {
                            if (!callback) return callback;
                            if (typeof callback !== 'function') throw new TypeError('callback must be a function');
                            return function (...args) {
                                try {
                                    return callback.call(this, ...args);
                                } catch (error) {
                                    return api_.apiLog.error(error);
                                }
                            };
                        };
                        options.condition = commonWrapper(options.condition);
                        options.failCallback = commonWrapper(options.failCallback);
                        options.successCallback = commonWrapper(options.successCallback);
                        callback = commonWrapper(callback);
                        if (globalOptions.wrapCallback) {
                            const originCallback = callback;
                            callback = function () {
                                return function (...args) {
                                    try {
                                        globalOptions.wrapCallback.call(this, ...args);
                                    } catch (error) {
                                        api_.apiLog.error(`${name} global callback error`, error);
                                    }
                                    return originCallback.call(this, ...args);
                                };
                            };
                        }
                        let callCount = 0;
                        let lastCallTime = 0;
                        let timeoutId = null;
                        let debounceTimeoutId = null;
                        const wrappedCallback = (context, data) => {
                            const now = Date.now();
                            if (callCount >= options.maxCalls) return;
                            if (options.throttleTime > 0 && now - lastCallTime < options.throttleTime) return;
                            if (debounceTimeoutId) clearTimeout(debounceTimeoutId);
                            const executeCallback = () => {
                                callCount++;
                                lastCallTime = now;
                                let res;
                                try {
                                    res = callback.call(options.context || context, ...data, options.extras);
                                    const boolRes = (res === undefined || res === null) ? false : true;
                                    if (!options.async) {
                                        (boolRes ? options.successCallback : options.failCallback)?.call(options.context || context, ...data, options.extras);
                                        if (boolRes && options.modify?.length) {
                                            const arrRes = Array.isArray(res) ? res : [res];
                                            if (arrRes.length < options.modify.length) throw new Error('modify length error');
                                            if (options.modify.some((item) => item > data.length - 1)) throw new Error('modify index error');
                                            for (let i = 0; i < options.modify.length; i++) {
                                                data[options.modify[i]] = arrRes[i];
                                            }
                                        }
                                    }
                                } catch (error) {
                                    options.failCallback?.(...data);
                                    api_.apiLog.error('callback error', error);
                                }
                                return res;
                            };
                            if (options.debounceTime > 0) {
                                debounceTimeoutId = setTimeout(executeCallback, options.debounceTime);
                                return;
                            }
                            if (options.timeout > 0) {
                                timeoutId = setTimeout(() => {
                                    api_.apiLog.warn(`Callback execution for "${name}" timed out`);
                                }, options.timeout);
                            }
                            if (timeoutId) clearTimeout(timeoutId);
                            return executeCallback();
                        };
                        if (!this.subscribeMap.has(name)) {
                            this.subscribeMap.set(name, new Map());
                        }
                        const decMap = this.subscribeMap.get(name);
                        if (options.uniqueId) {
                            for (const [key, value] of decMap) {
                                if (value.uniqueId === options.uniqueId) {
                                    if (options.uniqueMode === 'replace') {
                                        decMap.delete(key);
                                        break;
                                    } else if (options.uniqueMode === 'none') {
                                        return;
                                    } else {
                                        api_.apiLog.error(`${name} uniqueMode must be "replace" or "none"`);
                                        return;
                                    }
                                }
                            }
                        }
                        if (options.limit === decMap.size) {
                            const firstKey = decMap.keys().next().value;
                            if (firstKey) decMap.delete(firstKey);
                        }
                        decMap.set(wrappedCallback, options);
                        globalOptions.subscribeCallback?.((...data) => {
                            wrappedCallback(this, data);
                        }, options);
                        return () => this.unsubscribe(name, wrappedCallback, options);
                    },
                    unsubscribe: function (name, callback, options) {
                        if (typeof name !== 'string') throw new TypeError('Name must be a string');
                        if (typeof callback !== 'function') throw new TypeError('Callback must be a function');
                        if (!this.subscribeMap.has(name)) return;
                        try {
                            options.globalOptions?.unsubscribeCallback?.(callback, options);
                        } catch (error) {
                            api_.apiLog.error(`${name} global unsubscribe error`, error);
                        }
                        this.subscribeMap.get(name).delete(callback);
                    },
                    trigger: function (name, context, ...data) {
                        if (typeof name !== 'string') throw new TypeError('Name must be a string');
                        const globalModifyReturn = () => {
                            const globalModify = this.globalOptionsMap.get(name).modify;
                            if (globalModify.length) {
                                let res = null;
                                const paramsArray = [...data];
                                res = [];
                                try {
                                    for (const index of globalModify) {
                                        if (index > paramsArray.length - 1) throw new Error('Index out of range');
                                        res.push(paramsArray[index]);
                                    }
                                    if (res.length === 1) res = res[0];
                                } catch (error) {
                                    api_.apiLog.error(`${name} globalModify error`, error);
                                    res = paramsArray;
                                }
                                return res;
                            }
                            return;
                        };
                        if (!this.subscribeMap.has(name)) return globalModifyReturn();
                        const decMap = this.subscribeMap.get(name);
                        const sortedCallbacks = Array.from(decMap.entries()).sort((a, b) => b[1].weight - a[1].weight);
                        for (const [callback, options] of sortedCallbacks) {
                            if (options.condition && !options.condition.call(options.context || context, ...data, options.extras)) continue;
                            if (options.once) {
                                decMap.delete(callback);
                            }
                            const res = callback(context, data);
                            const boolRes = (res === undefined || res === null) ? false : true;
                            if (options.stopPropagation && (options.async || boolRes)) break;
                        }
                        if (decMap.size === 0) {
                            this.subscribeMap.delete(name);
                        }
                        return globalModifyReturn();
                    },
                };
                return (name, globalOptions = {}, commonOptions = {}) => {
                    api.setGolbalOptions(name, globalOptions);
                    return {
                        subscribe: (callback, options = {}) => api.subscribe(name, callback, Object.assign({}, commonOptions, options)),
                        trigger: (...data) => api.trigger(name, ...data),
                        manualTrigger: (context) => {
                            const decMap = api.subscribeMap.get(name) || new Map();
                            const newMap = new Map();
                            for (const [callback, options] of decMap) {
                                newMap.set(
                                    (...data) => callback(context, data),
                                    options,
                                );
                            }
                            return newMap;
                        },
                        matchCallback: (context, ...data) => {
                            let map = api.subscribeMap.get(name);
                            if (!map?.size) return 0;
                            const newMap = new Map();
                            for (const [callback, options] of map) {
                                if (options.condition && !options.condition.call(context, ...data)) continue;
                                newMap.set(
                                    (...data) => callback(context, data),
                                    options,
                                );
                            }
                            return newMap;
                        },
                        clear: () => api.subscribeMap.delete(name),
                        callbackNum: () => { return api.subscribeMap.get(name)?.size || 0; },
                        matchCallbackNum: (context, ...data) => {
                            let map = api.subscribeMap.get(name);
                            if (!map?.size) return 0;
                            let matchCount = 0;
                            for (const [_, options] of map) {
                                if (options.condition && !options.condition.call(context, ...data)) continue;
                                matchCount++;
                            }
                            return matchCount;
                        }
                    };
                };
            },
            security:{
                setSecurePolicy: function () {
                    if (!unsafeWindow.isSecureContext || !unsafeWindow.trustedTypes?.createPolicy || unsafeWindow.trustedTypes?.defaultPolicy) return;
                    unsafeWindow.trustedTypes.createPolicy("default", {
                        createScriptURL: (url) => url,
                        createHTML: (html) => html,
                        createScript: (script) => script
                    });
                },
                trustedScript: (() => {
                    try {
                        let test_value;
                        eval('test_eval = 1');
                        return function (str) {
                            return str;
                        };
                    } catch (error) {
                        if (unsafeWindow.trustedTypes) {
                            const policy = unsafeWindow.trustedTypes.createPolicy('eval', {
                                createScript: (script) => script
                            });
                            return function (str) {
                                return policy.createScript(str);
                            };
                        } else {
                            api.apiLog.error('trustedTypes not support', error);
                        }
                    };
                })()
            },
            type:{
                isClassInstance: function (obj) {
                    return obj !== null
                        && typeof obj === 'object'
                        && obj.constructor !== Object;
                },
                isNative: function (name, fun) {
                    const fun_str = fun.toString();
                    if (!api.utils.ua.includes('Firefox')) {
                        return `function ${name}() { [native code] }` === fun_str;
                    } else {
                        return `function ${name}() {\n    [native code]\n}` === fun_str;
                    }
                },
            },
            randomColor: function () {
                var letters = '0123456789ABCDEF';
                var color = '#';
                for (var i = 0; i < 6; i++) {
                    color += letters[Math.floor(Math.random() * 16)];
                }
                return color;
            },
            defineProperty: function (obj, property, descriptor) {
                const old_descriptor = Object.getOwnPropertyDescriptor(obj, property);
                if (old_descriptor?.configurable === false) {
                    api.apiLog.error(property, 'is not configurable, hook error !', old_descriptor);
                    return;
                }
                Object.defineProperty(obj, property, descriptor);
            },
            ua: unsafeWindow.navigator.userAgent,
            console: unsafeWindow.console,
            Logger: {
                PREFIX: '[Logger]',
                LEVELS: {
                    DEBUG: { name: 'DEBUG', color: '#7f8c8d', show: true },
                    INFO: { name: 'INFO', color: '#2ecc71', show: true },
                    WARN: { name: 'WARN', color: '#f1c40f', show: true },
                    ERROR: { name: 'ERROR', color: '#e74c3c', show: true }
                },

                _log(level, ...args) {
                    if (!this.LEVELS[level].show) return;

                    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
                    const prefix = `%c${this.PREFIX}[${timestamp}][${level}]`;
                    const style = `color: ${this.LEVELS[level].color}; font-weight: bold;`;

                    api.apiLog.log(prefix, style, ...args);

                    if (level === 'ERROR') {
                        api.apiLog.trace();
                    }
                },

                debug(...args) {
                    this._log('DEBUG', ...args);
                },

                info(...args) {
                    this._log('INFO', ...args);
                },

                warn(...args) {
                    this._log('WARN', ...args);
                },

                error(...args) {
                    this._log('ERROR', ...args);
                },

                scope(moduleName) {
                    return {
                        debug: (...args) => this._log('DEBUG', `[${moduleName}]`, ...args),
                        info: (...args) => this._log('INFO', `[${moduleName}]`, ...args),
                        warn: (...args) => this._log('WARN', `[${moduleName}]`, ...args),
                        error: (...args) => this._log('ERROR', `[${moduleName}]`, ...args)
                    };
                }
            },
            origin: {
                hook: function (prop, value, global = unsafeWindow) {
                    let dec = global;
                    let lastProp = prop;
                    if (prop.includes('.')) {
                        const props = prop.split('.');
                        lastProp = props.pop();
                        props.forEach(prop => {
                            dec = dec[prop];
                        });
                    }
                    const originFun = dec[lastProp];
                    if (!api.utils.type.isNative(lastProp, originFun)) {
                        api.apiLog.error(`${lastProp} have been modified`);
                    }
                    if (typeof value !== 'function' && !api.utils.type.isClassInstance(value)) {
                        const descriptor = value
                        api.utils.defineProperty(dec, lastProp, descriptor);
                    } else {
                        dec[lastProp] = value;
                        value.toString = originFun.toString.bind(originFun);
                    }
                    this.hooked.set(prop, {
                        originFun,
                        fakeFun: value
                    });
                },
                hooked: new Map(),
                injiect: function (global) {
                    for (const [prop, { fakeFun }] of this.hooked) {
                        this.hook(prop, fakeFun, global);
                    }
                }
            },
            
        };
        // 创建API工厂
        api.factory = api.utils.createApiFactory();
        // 创建日志记录器
        api.apiLog = api.utils.Logger.scope('API');
    }

    // ==DOM操作模块==
    function domApiInit() {
        // 基础DOM查询
        api.dom.query.$ = unsafeWindow.document.querySelector.bind(unsafeWindow.document);
        api.dom.query.$$ = unsafeWindow.document.querySelectorAll.bind(unsafeWindow.document);

        // createElement增强
        api.dom.createElement = api.factory('createElement');
        const origin_createElement = unsafeWindow.document.createElement;
        function fakeCreateElement(tag, options) {
            let node = origin_createElement.call(this, tag, options);
            api.dom.createElement.trigger(this, node, tag, options);
            return node;
        }
        api.utils.origin.hook('document.createElement', fakeCreateElement);

        // waitElement实现
        api.dom.waitElement = function (observeNode, condition, options = {}) {
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const { timeout = 10000, type = 'add', observeOptions = { childList: true, subtree: true } } = options;
                const monitor = new MutationObserver(function (mutationsList) {
                    if (Date.now() - startTime > timeout) {
                        monitor.disconnect();
                        reject('timeout');
                        return;
                    }
                    if (type === 'none') {
                        if (condition(mutationsList)) {
                            monitor.disconnect();
                            resolve();
                        }
                        return;
                    }
                    for (let mutation of mutationsList) {
                        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                            if (type === 'add') {
                                decNodes = mutation.addedNodes;
                            } else if (type === 'remove') {
                                decNodes = mutation.removedNodes;
                            }
                            for (let child of decNodes) {
                                if (!condition(child)) continue;
                                monitor.disconnect();
                                resolve(child);
                                return;
                            }
                        }
                    }
                });
                monitor.observe(observeNode, observeOptions);
            });
        }

        // iframe处理
        api.dom.iframe = {
            oncreate: api.factory('frameOncreate'),
            contentWindow: api.factory('frameOnget'),
        };
        api.dom.createElement.subscribe((node) => {
            api.dom.iframe.oncreate.trigger(node);
            const contentWindow_getter = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow").get;
            api.utils.defineProperty(node, 'contentWindow', {
                get: function () {
                    const contentWindow = contentWindow_getter.call(node);
                    delete node.contentWindow;
                    if (!contentWindow || this.src !== 'about:blank') return contentWindow;
                    api.dom.iframe.contentWindow.trigger(this, contentWindow, node);
                    return contentWindow;
                },
                configurable: true
            });
        }, { condition: (_, tag) => tag === 'iframe' });
    }

    // ==事件处理模块==
    function eventApiInit() {
        // URL变化监听
        api.event.urlChange = api.factory('urlChange');
        function urlChangeApiInit() {
            function setHistoryHook(window_obj) {
                const wrap = function (type) {
                    const origin = window_obj.history[type];
                    return async function () {
                        let rv;
                        try {
                            rv = origin.apply(this, arguments);
                        } catch (error) {
                            api.apiLog.error('history hook error', error, 0);
                            return;
                        }
                        let url = arguments[2] || unsafeWindow.location.href;
                        url.startsWith('/') && (url = unsafeWindow.location.origin + url);
                        !url.startsWith('http') && (url = unsafeWindow.location.origin + '/' + url);
                        urlChange(url);
                        return rv;
                    };
                };
                window_obj.history.pushState = wrap('pushState');
                window_obj.history.replaceState = wrap('replaceState');
                window_obj.addEventListener('popstate', function (event) {
                    urlChange(event);
                });
                window_obj.addEventListener('hashchange', function (event) {
                    urlChange(event);
                });
            }
            let href = unsafeWindow.location.href;
            function urlChange(event = null) {
                let destination_url;
                if (typeof (event) === 'object') {
                    destination_url = event?.destination?.url || '';
                    if (!destination_url && event?.state?.as) {
                        destination_url = event.state.as;
                    }
                    if (!destination_url && event?.state?.url) {
                        destination_url = event.state.url;
                    }
                    if (destination_url && !destination_url.startsWith('http')) {
                        if (destination_url.startsWith('/')) destination_url = unsafeWindow.location.origin + destination_url;
                        else destination_url = unsafeWindow.location.origin + '/' + destination_url;
                    }
                }
                else {
                    destination_url = event;
                }
                if (!destination_url.startsWith('http')) return;
                if (destination_url === href) return;
                const oldHref = href;
                href = destination_url || unsafeWindow.location.href;
                api.event.urlChange.trigger(this, href, oldHref);
                api.apiLog.info('网页url改变 href -> ' + href);
            }
            setHistoryHook(unsafeWindow);
        }
        urlChangeApiInit();

        // DOM加载完成事件
        api.event.domContentLoaded = api.factory('domContentLoaded');
        unsafeWindow.document.addEventListener('DOMContentLoaded', function () {
            api.event.domContentLoaded.trigger(this);
        });

        // 事件监听器增强
        api.event.addEventListener = api.factory('addEventListener', { modify: [0, 1] }, { stopPropagation: true, modify: [0, 1] });
        const origin_addEventListener = unsafeWindow.addEventListener;
        const fakeAddEventListener = function (tag, fun, options) {
            [tag, fun, options] = api.event.addEventListener.trigger(this, tag, fun, options);
            return origin_addEventListener.call(this, tag, fun, options);
        };
        api.utils.origin.hook('addEventListener', fakeAddEventListener);

        // 双击处理 start
        api.event.getDbclickAPI = function (node, handler, timeout = 300) {
            if (node.inject_dbclick) return;
            node.inject_dbclick = true;

            let isClick = false;
            let timers = new Set(); // 使用 Set 来管理定时器
            const originOnclick = node.onclick;

            // 清理所有定时器的函数
            const clearAllTimers = () => {
                timers.forEach(timer => clearTimeout(timer));
                timers.clear();
            };

            const fakeOnclick = (e) => {
                if (isClick) {
                    isClick = false;
                    originOnclick?.call(node, e);
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const timer = setTimeout(() => {
                    isClick = true;
                    clearAllTimers();
                    node.click();
                }, timeout);

                timers.add(timer);
            };

            const dblclickHandler = (e) => {
                e.preventDefault();
                clearAllTimers();
                handler.call(node, e); // 保持 this 上下文
            };

            return {
                set: () => {
                    node.onclick = null;
                    // 使用 options 对象统一配置
                    const eventOptions = {
                        capture: true,
                        passive: false // 明确声明不是被动事件
                    };

                    node.addEventListener('click', fakeOnclick, eventOptions);
                    node.addEventListener('dblclick', dblclickHandler, eventOptions);
                },
                unset: () => {
                    clearAllTimers(); // 清理遗留的定时器
                    node.onclick = originOnclick;

                    const eventOptions = { capture: true };
                    node.removeEventListener('click', fakeOnclick, eventOptions);
                    node.removeEventListener('dblclick', dblclickHandler, eventOptions);

                    delete node.inject_dbclick; // 清理标记
                }
            };
        };
        // 双击处理 end

        // message处理 start
        api.event.message = {
            onMessage: api.factory('messageOnMessage'),
            postMessage: api.factory('postMessage', { modify: [0, 1] }, { stopPropagation: true, modify: [0, 1] })
        };
        const origin_postMessage = unsafeWindow.postMessage;
        function fakePostMessage(message, targetOrigin, transfer) {
            [message, targetOrigin] = api.event.message.postMessage.trigger(this, message, targetOrigin);
            return origin_postMessage.call(this, message, targetOrigin, transfer);
        }
        api.utils.origin.hook('postMessage', fakePostMessage);
        const fakeOnMessage = function (event) {
            const res = api.event.message.onMessage.trigger(this, event);
            if (!res) return;
            event.stopPropagation();
            event.stopImmediatePropagation();
        };

        unsafeWindow.addEventListener('message', fakeOnMessage, { capture: true, priority: true });
        api.event.addEventListener.subscribe((tag, fun, options) => {
            if (!options) return;
            options.capture = false;
            options.priority = false;
        }, { condition: tag => tag === 'message' });
        // message处理 end
    }

    // ==网络请求模块==
    function netApiInit() {
        api.net = {};
        api.net.fetch = {};
        api.net.fetch.request = api.factory('fetchRequest', { modify: [0, 1] }, { stopPropagation: true });
        api.net.fetch.response = api.factory('fetchResponse', { modify: 0 }, { stopPropagation: true, modify: 0 });
        api.net.fetch.response.json = api.factory('fetchResponseJson', {}, { stopPropagation: true });
        api.net.fetch.response.text = api.factory('fetchResponseText', { modify: 0 }, { modify: 0, stopPropagation: true, });
        api.net.fetch.response.commonTextToJsonProcess = api.factory('commonTextToJsonProcess', {}, { stopPropagation: true, });
        api.net.fetch.response.processJson = function (json, rule, { traverse_all = false } = {}) {
            rule && api.data.dataProcess.obj_process(json, rule, { traverse_all });
            return true;
        };

        const origin_fetch = unsafeWindow.fetch;
        const fake_fetch = function () {
            const fetch_ = async function (uri, options) {
                async function fetch_request(response) {
                    const originText = response.text.bind(response);
                    const url = response.url;
                    response.text = async function () {
                        let text = await originText();
                        // const start = performance.now();
                        const save = text;
                        try {
                            const options = { body: uri.body_ };
                            text = api.net.fetch.response.text.trigger(this, text, url, options);
                            if (text instanceof Promise) text = await text;
                            if (api.net.fetch.response.commonTextToJsonProcess.matchCallbackNum(this, null, url, options)) {
                                let json = JSON.parse(text);
                                api.net.fetch.response.commonTextToJsonProcess.trigger(this, json, url, options);
                                text = JSON.stringify(json);
                            }
                        } catch (error) {
                            api.apiLog.error('fetch response text error', error);
                            text = save;
                        }
                        return text;
                    };
                    const cloneResponse = response.clone();
                    const originJson = response.json.bind(response);
                    response.json = async function () {
                        let json = await originJson();
                        try {
                            api.net.fetch.response.json.trigger(this, json, url, options);
                        } catch (error) {
                            api.apiLog.error('fetch response json error', error);
                            json = await cloneResponse.json();
                        }
                        return json;
                    };
                    response = api.net.fetch.response.trigger(this, response, url, options);
                    return response;
                }
                let req;
                try {
                    if (typeof uri === 'string') [uri, options] = api.net.fetch.request.trigger(this, uri, options, 'fetch');
                    if (!(typeof uri === 'string' ? uri : uri.url)) return new Promise((resolve, reject) => reject('fetch error'));
                    req = origin_fetch(uri, options).then(fetch_request);
                } catch (error) {
                    api.apiLog.error('fetch error', error);
                }
                return req;
            };
            return fetch_;
        }();
        api.utils.origin.hook('fetch', fake_fetch);

        class fakeRequest extends unsafeWindow.Request {
            constructor(input, options = void 0) {
                if (typeof input === 'string') {
                    try {
                        [input, options] = api.net.fetch.request.trigger(null, input, options, 'request');
                    } catch (error) {
                        api.apiLog.error('Request error', error);
                    }
                }
                super(input, options);
                this.url_ = input;
                if (options && 'body' in options) this['body_'] = options['body'];
            }
        };
        api.utils.origin.hook('Request', fakeRequest);


        api.net.xhr = {
            response: {
                text: api.factory('xhrResponseText', { modify: 0 }, { stopPropagation: true, modify: 0 }),
                json: api.factory('xhrResponseJson', {}, { stopPropagation: true }),
            },
            request: {
                open: api.factory('xhrRequestOpen', { modify: [0, 1, 2] }, { stopPropagation: true }),
                send: api.factory('xhrRequestSend', { modify: [0, 1] }, { stopPropagation: true }),
            }
        };

        class fakeXMLHttpRequest extends unsafeWindow.XMLHttpRequest {
            open(method, url, ...opts) {
                [method, url, opts] = api.net.xhr.request.open.trigger(this, method, url, opts);
                if (url === '') return null;
                this.url_ = url;
                return super.open(method, url, ...opts);
            }
            send(body) {
                let url;
                [url, body] = api.net.xhr.request.send.trigger(this, this.url_, body);
                if (url === '') {
                    const hook_get = (name, value) => {
                        api.utils.defineProperty(this, name, {
                            get: function () {
                                return value;
                            }
                        });
                    };
                    hook_get('readyState', 4);
                    hook_get('statusText', 'Forbidden');
                    hook_get('responseText', '');
                    hook_get('response', '');
                    hook_get('status', 403);
                    if (typeof this.onload === 'function') {
                        this.onload();
                    }
                    return;
                }
                this.body_ = body;
                super.send(body);
            }
            get xhrResponseValue() {
                const xhr = this;
                if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                    let result = super.response;
                    const url = xhr.responseURL;
                    const result_type = typeof result;
                    if (result_type === 'string') {
                        const options = { body: this.body_, xhr: this };
                        try {
                            if (api.net.xhr.response.json.matchCallbackNum(this, null, url, options)) {
                                try {
                                    const json = JSON.parse(result);
                                    api.net.xhr.response.json.trigger(this, json, url, options);
                                    result = JSON.stringify(json);
                                } catch (error) {
                                    api.apiLog.error(error);
                                }
                            } else {
                                result = api.net.xhr.response.text.trigger(this, result, options);
                            }
                        } catch (error) {
                            api.apiLog.error(error);
                        }
                    }
                    return result;
                }
                return super.response;
            }
            get responseText() {
                return this.xhrResponseValue;
            }
            get response() {
                return this.xhrResponseValue;
            }
        };
        api.utils.origin.hook('XMLHttpRequest', fakeXMLHttpRequest);

        api.dom.iframe.contentWindow.subscribe((contentWindow) => {
            api.utils.origin.injiect(contentWindow);
        });

        const dyncLoadFlags = ['iframe', 'img', 'script', 'link', 'video', 'audio', 'source', 'object'];
        api.net.dyncFileLoad = api.factory('dyncFileLoad', { modify: 0 }, { stopPropagation: true, modify: 0 });
        const setterMap = {
            iframe: {
                setter: Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src').set,
                prop: 'src'
            },
            img: {
                setter: Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set,
                prop: 'src'
            },
            script: {
                setter: Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src').set,
                prop: 'src'
            },
            link: {
                setter: Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href').set,
                prop: 'href'
            },
            video: {
                setter: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src').set,
                prop: 'src'
            },
            audio: {
                setter: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src').set,
                prop: 'src'
            },
            source: {
                setter: Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'src').set,
                prop: 'src'
            },
            object: {
                setter: Object.getOwnPropertyDescriptor(HTMLObjectElement.prototype, 'data').set,
                prop: 'data'
            }
        };
        const hookSrc = function (node) {
            const property = setterMap[node.tagName.toLowerCase()].prop;
            api.utils.defineProperty(node, property, {
                get: function () {
                    return this.src_;
                },
                set: function (value) {
                    let url = value;
                    const funSet = api.net.dyncFileLoad.matchCallback(this, value, node);
                    for (const [fun, options] of funSet) {
                        if (options.tag === node.tagName.toLowerCase()) {
                            const tmp = fun(url);
                            if (tmp !== undefined) url = tmp;
                        }
                    }
                    this.src_ = url;
                    if (!url) return;
                    setterMap[node.tagName.toLowerCase()].setter.call(node, url);
                }
            });
            node.addEventListener('load', function (event) {
                const funSet = api.net.dyncFileLoad.matchCallback(this, node.src, node);
                for (const [_, options] of funSet) {
                    if (options.tag === node.tagName.toLowerCase() && options.onload) {
                        const res = options.onload.call(event, node);
                        if (!res) return;
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                    };
                }
            }, {
                capture: true,
                priority: true,
                once: true,
            });
            const origin_addEventListener = node.addEventListener;
            node.addEventListener = function (tag, fun, options) {
                if (tag === 'load') {
                    if (options) {
                        options.capture = false;
                        options.priority = false;
                    }
                    origin_addEventListener.call(node, tag, fun, options);
                }
            };
        };
        api.dom.createElement.subscribe((node) => {
            const funSet = api.net.dyncFileLoad.manualTrigger(node);
            for (const [_, options] of funSet) {
                if (options.tag === node.tagName.toLowerCase()) {
                    hookSrc(node);
                    return;
                }
            }
        }, { condition: (_, tag) => dyncLoadFlags.includes(tag) });
    }

    // ==动画效果模块==
    function animateApiInit() {
        api.animate = {
            backgroundFlash: function (decNode, options = {}) {
                const {
                    frequency = 100,
                    isFront = false,
                    timeout = 0
                } = options;
                let background_color_interval_id;
                let originTransition;
                let originColor;
                const decProName = isFront ? 'color' : 'backgroundColor';
                const startAnimation = () => {
                    if (timeout > 0) {
                        setTimeout(() => {
                            closeAnimation();
                        }, timeout);
                    }
                    originTransition = decNode.style.transition;
                    originColor = decNode.style[decProName];
                    decNode.style.transition = `${decNode.style.transition && (decNode.style.transition + " , ")}background-color 0.5s ease`;
                    let lastTime = 0;
                    const interval = frequency;
                    const animate = (timestamp) => {
                        if (timestamp - lastTime >= interval) {
                            decNode.style[decProName] = api.utils.randomColor();
                            lastTime = timestamp;
                        }
                        background_color_interval_id = requestAnimationFrame(animate);
                    };
                    background_color_interval_id = requestAnimationFrame(animate);
                };

                const closeAnimation = () => {
                    if (!background_color_interval_id) return;
                    cancelAnimationFrame(background_color_interval_id);
                    decNode.style[decProName] = originColor;
                    decNode.style.transition = originTransition;
                };
                return {
                    start: startAnimation,
                    close: closeAnimation
                };
            },
            changeColor: function (decNode, options = {}) {
                const {
                    color = 'yellow',
                    isFront = false,
                    timeout = 0
                } = options;
                let decProName = isFront ? 'color' : 'backgroundColor';
                let originColor = decNode.style[decProName];
                decNode.style[decProName] = color;
                if (timeout > 0) setTimeout(() => {
                    decNode.style[decProName] = originColor;
                }, timeout);
                return () => {
                    decNode.style[decProName] = originColor;
                };
            },
            headerScan: function (decNode, color = 'yellow') {
                let scanLine;
                let styleElement;
                const startAnimation = () => {
                    styleElement = document.createElement('style');
                    styleElement.innerHTML = `
                                                @keyframes scan {
                                                0%, 100% { top: 0; }
                                                50% { top: calc(100% - 2px); }
                                                }
                                                 .avatar-container {
                                                    position: relative;
                                                    overflow: hidden;
                                                }
                                                .scan-line {
                                                position: absolute;
                                                top: 0;
                                                left: 0;
                                                width: 100%;
                                                height: 2px;
                                                background-color: ${color};
                                                animation: scan 0.5s linear infinite;
                                                }
                                            `;
                    unsafeWindow.document.head.appendChild(styleElement);
                    scanLine = unsafeWindow.document.createElement('div');
                    scanLine.className = 'scan-line';
                    decNode.appendChild(scanLine);
                    decNode.classList.add('avatar-container');
                };
                const closeAnimation = () => {
                    scanLine.remove();
                    styleElement.remove();
                    decNode.classList.remove('avatar-container');
                };
                return {
                    start: startAnimation,
                    close: closeAnimation
                };
            }
        }
    }

    // ==数据处理模块==
    function dataApiInit() {
        // ... 数据处理类实例 ...
        class DATA_PROCESS {
            constructor() {
                this.obj_filter;
                this.obj_storage = {};
            }
            condition_split_and_tag = '&&';
            condition_split_or_tag = '||';
            value_split_and_tag = '&';
            value_split_or_tag = '|';

            storage_obj(key, obj) {
                this.obj_storage[key] = obj;
            }

            set_obj_filter(obj_filter) {
                if (typeof obj_filter !== 'function') return;
                this.obj_filter = function () {
                    try {
                        obj_filter.apply(this, arguments);
                    } catch (error) {
                        api.apiLog.error(error);
                        return false;
                    }
                };
            };

            text_process(data, values, mode, traverse_all) {
                if (!values) return data;
                const origin_data = data;
                try {
                    mode = mode || 'cover';
                    if (mode === 'reg') {
                        for (let value of values) {
                            const patten_express = value.split(SPLIT_TAG)[0];
                            const replace_value = value.split(SPLIT_TAG)[1];
                            const patten = new RegExp(patten_express, "g");
                            data = data.replace(patten, replace_value);
                        }
                    }
                    if (mode === 'cover') {
                        data = values[0];
                    }
                    if (mode === 'insert') {
                        traverse_all = traverse_all || false;
                        let json_data;
                        try {
                            json_data = JSON.parse(data);
                        } catch (error) {
                            api.apiLog.error('text_process JSON parse error', error);
                            return data;
                        }
                        this.obj_process(json_data, values, { traverse_all: traverse_all });
                        data = JSON.stringify(json_data);
                    }
                } catch (error) {
                    api.apiLog.error('text_process error', error);
                    data = origin_data;
                }
                return data;
            }

            get_relative_path(basic_path, relative_path) {
                if (relative_path === '/') return basic_path;
                let real_path;
                if (relative_path.startsWith('/.')) {
                    real_path = basic_path + relative_path.slice(1);
                }
                if (relative_path.startsWith('.')) {
                    const reg = /[\.\[]/g;
                    const positions = [];
                    let match;
                    while ((match = reg.exec(basic_path)) !== null) {
                        positions.push(match.index);
                    }
                    if (positions.length === 0) {
                        return basic_path;
                    }
                    const pointer_match = relative_path.match(/^\.+/);
                    const split_index = positions[positions.length - pointer_match[0].length];
                    const relative_attribute = relative_path.slice(pointer_match[0].length);
                    real_path = basic_path.slice(0, split_index) + (relative_attribute ? ((relative_attribute.startsWith('[') ? '' : '.') + relative_attribute) : '');
                }
                return this.convertPathToBracketNotation(real_path);
            }

            value_parse(parse_value, path_info = null, json_obj = null) {
                const formula_match = parse_value.match(/\{.*?\}/g);
                if (formula_match) {
                    for (let express_ of formula_match) {
                        const express = express_.slice(1, -1);
                        if (!express) continue;
                        parse_value = parse_value.replace(express_, this.value_parse(express, path_info, json_obj));
                    }
                }
                const json_math = parse_value.match(/^json\((.*)\)$/);
                if (json_math) return JSON.parse(json_math[1]);
                const obj_match = parse_value.match(/^obj\((.*)\)$/);
                if (obj_match) return this.string_to_value(unsafeWindow, obj_match[1]);
                const storage_obj_match = parse_value.match(/^sobj\((.*)\)$/);
                if (storage_obj_match) return this.string_to_value(this.obj_storage, storage_obj_match[1]);
                const number_match = parse_value.match(/^num\((.*)\)$/);
                if (number_match) return Number(number_match[1]);
                const method_match = parse_value.match(/^method\((.*)\)$/);
                if (method_match) {
                    // eval 限制的时候可以使用num() obj()这些添加数字对象 方法也要放到unsafeWindow里 例：method(b("123",num(23)))
                    // 不限制的时候 不能使用num和obj 方法不需要放到unsafeWindow里 例：method(b("123",23))
                    return eval(api.utils.security.trustedScript(method_match[1]));
                }
                const deal_obj_match = parse_value.match(/^dealObj\((.*)\)$/);
                if (deal_obj_match) {
                    const path_msg = deal_obj_match[1];
                    return this.string_to_value(json_obj.this.get_relative_path(path_info.deal_path, path_msg));
                }
                const path_obj_match = parse_value.match(/^pathObj\((.*)\)$/);
                if (path_obj_match) {
                    const path_msg = path_obj_match[1];
                    return this.string_to_value(json_obj, this.get_relative_path(path_info.path, path_msg));
                }
                const abs_obj_match = parse_value.match(/^absObj\((.*)\)$/);
                if (abs_obj_match) {
                    const abs_path = abs_obj_match[1];
                    return this.string_to_value(json_obj, abs_path);
                }
                const string_match = parse_value.match(/^["'](.*)["']$/);
                if (string_match) return string_match[1];
                if (parse_value === 'undefined') return undefined;
                if (parse_value === 'null') return null;
                return parse_value;
            }

            string_to_value(obj, path) {
                if (!path) throw new TypeError('path 为空');
                return eval(api.utils.security.trustedScript(path.replace('json_obj', 'obj')));
            }

            get_lastPath_and_key(path) {
                let last_path, last_key;
                let matches = path.match(/\[(.*?)\]/g);
                if (matches && matches.length > 0) {
                    const tmp = matches[matches.length - 1];
                    if (tmp.includes('["')) {
                        last_key = tmp.replace(/\["|"\]/g, '');
                    } else {
                        last_key = Number(tmp.replace(/\[|\]/g, ''));
                    }
                    last_path = path.substring(0, path.lastIndexOf(tmp));
                }
                if (!matches) {
                    matches = path.split('.');
                    if (matches && matches.length > 0) {
                        last_key = matches[matches.length - 1];
                        last_path = path.replace('.' + last_key, '');
                    }
                }
                return [last_path, last_key];
            }

            convertPathToBracketNotation(path) {
                if (!path) return '';
                return path.replace(/\.[\d\w\-\_\$@]+/g, function (match) {
                    return '["' + match.slice(1) + '"]';
                });
            }

            paths_sort(paths_arr, key_name = null, reverse = false) {
                // 路径格式是json_obj["onResponseReceivedActions"][0]["appendContinuationItemsAction"]
                // 支持数组元素是对象，根据里面的某个属性排序
                // 支持数组元素是字符串，根据字符串排序
                if (!Array.isArray(paths_arr)) {
                    throw new Error('paths_arr must be an array');
                }
                if (paths_arr.length === 0) return;
                let tmp_paths_arr = paths_arr;
                if (!key_name) {
                    key_name = 'path';
                    if (typeof paths_arr[0] !== 'string') throw new Error('paths_arr must be a string array');
                    tmp_paths_arr = [];
                    paths_arr.forEach(path => {
                        tmp_paths_arr.push({
                            path: path
                        });
                    });
                }
                const reverse_factor = reverse ? -1 : 1;
                tmp_paths_arr.sort((a, b) => {
                    function get_sort_key(obj) {
                        if (!obj.sort_keys) {
                            const reg = /\["?(.*?)"?\]/g;
                            let matches = [];
                            let match;
                            while (match = reg.exec(obj[key_name])) {
                                if (!match[0].startsWith('["')) {
                                    if (isNaN(match[1])) throw new Error('array index must be a number');
                                    match[1] = parseInt(match[1]);
                                }
                                matches.push(match[1]);
                            }
                            obj.sort_keys = matches;
                        }
                    }
                    if (a[key_name] === b[key_name]) return 0;
                    get_sort_key(a);
                    get_sort_key(b);
                    const a_sort_keys = a.sort_keys;
                    const b_sort_keys = b.sort_keys;
                    if (a_sort_keys.length !== b_sort_keys.length) {
                        return (b_sort_keys.length - a_sort_keys.length) * reverse_factor;
                    }
                    for (let i = 0; i < a_sort_keys.length; i++) {
                        if (a_sort_keys[i] !== b_sort_keys[i]) {
                            return (b_sort_keys[i] > a_sort_keys[i] ? 1 : -1) * reverse_factor;
                        }
                    }
                    return 0;
                });
                if (paths_arr !== tmp_paths_arr) {
                    paths_arr.length = 0;
                    tmp_paths_arr.forEach(path_info => {
                        paths_arr.push(path_info.path);
                    });
                }
            }

            /**
            *
            * @param {any} json_data - json字符串 或者 json 对象.
            * @param {any} express_info - 字符串 || 数组 || 对象（{a: '表达式1', b:'表达式2'}）. 
            * @param {boolean} [traverse_all=false] - 是否遍历所有 遍历所有会返回所有符合的值，否则返回第一个.
            * @return {any} 字符串 || 数组 || 对象.  返回一个值 || 返回一个数组 返回结果的下标为0的值为输入表达式数组下标0对应的结果 || 直接修改传入的对象，返回值也是该对象 结果{a: '表达式1的值', b:'表达式2的值'}
            */
            obj_get_values(json_data, express_info, { traverse_all = false, deep_traverse = false, get_value = true, get_path = false } = {}) {
                let json_obj;
                let express_list;
                const express_type = typeof express_info;
                try {
                    if (express_type === 'string' || express_type === 'function') {
                        express_list = [express_info];
                    } else {
                        if (express_type !== 'object' && !Array.isArray(express_info)) throw new TypeError('express error');
                        express_list = Object.values(express_info);
                        if (express_list.some(item => typeof item !== 'string')) throw new TypeError('express error');
                    }
                    if (typeof json_data === 'string') {
                        json_obj = JSON.parse(json_data);
                    } else {
                        if (typeof json_data === 'object') json_obj = json_data;
                    }
                    if (!json_obj) throw new TypeError('express error');
                    const abs_infos = this.obj_process(json_obj, express_list, { traverse_all, deep_traverse, get_value, get_path });
                    if (express_type === 'object') {
                        Object.keys(express_info).map((item, index) => {
                            express_info[item] = abs_infos[index];
                        });
                        return express_info;
                    }
                    return Array.isArray(express_info) ? abs_infos : abs_infos?.[0];
                } catch (error) {
                    api.apiLog.error(error);
                }
                return;
            }

            obj_process(json_obj, express_list, { traverse_all = false, get_value = false, get_path = false, deep_traverse = false } = {}) {

                if (typeof json_obj !== 'object') {
                    api.apiLog.error('obj_process不是对象', express_list);
                    return;
                }
                const express_list_type = typeof express_list;
                if (express_list_type === 'function') {
                    try {
                        express_list = express_list(json_obj);
                        if (!express_list || Array.isArray(express_list) && express_list.length === 0) return;
                    } catch (error) {
                        api.apiLog.error('obj_process express_list函数执行错误', error);
                        return;
                    }
                } else if (express_list_type === 'string') {
                    express_list = [express_list];
                }
                const data_this = this;
                const abs_path_info_list = [];
                const relative_path_info_set = new Set();
                let get_value_results = [];
                if (!Array.isArray(express_list)) debugger;
                if (!json_obj || !express_list || !Array.isArray(express_list) || express_list.length === 0) return;
                const is_array_obj = Array.isArray(json_obj);
                try {
                    if (get_value || get_path) {
                        express_list.map((item) => {
                            const match = item.match(/^(.*?)(?:\[(\d+)\])?$/);
                            if (!match) throw new Error('express error');
                            const real_key = match[1];
                            const array_index = Number(match[2]);
                            relative_path_info_set.add({
                                "express": item,
                                "array_index": array_index,
                                "short_key": real_key.split('.').pop(),
                                "real_key": real_key,
                                "paths": [] // 存储结果
                            });
                        });

                        obj_property_traverse(json_obj, '', relative_path_info_set, { traverse_all, deep_traverse });
                        relative_path_info_set.forEach(item => {
                            get_value_results.push(
                                item.paths.map(tmp => {
                                    let result_path = 'json_obj' + tmp;
                                    let result_value = this.string_to_value(json_obj, 'json_obj' + tmp);
                                    let result;
                                    if (!isNaN(item.array_index)) {
                                        if (!Array.isArray(result_value) || result_value.length <= item.array_index) throw new Error('array index error');
                                        if (get_path && get_value) {
                                            result = {
                                                value: result_value[item.array_index],
                                                path: `${result_path}[${item.array_index}]`
                                            };
                                        } else {
                                            result = get_path ? `${result_path}[${item.array_index}]` : result_value[item.array_index];
                                        }
                                    } else {
                                        if (get_path && get_value) {
                                            result = {
                                                value: result_value,
                                                path: result_path
                                            };
                                        } else {
                                            result = get_path ? result_path : result_value;
                                        }
                                    }
                                    return result;
                                })
                            );
                        });

                        // 如果相同表达式结果只有一个，就返回一个
                        get_value_results = get_value_results.map(item => {
                            if (item.length === 1) return item[0];
                            return item;
                        });
                        // finally 统一返回
                        return;
                    }
                    express_list.forEach(express => {
                        if (!express) return;
                        let reg;
                        const express_type = typeof (express);
                        let matches;
                        let conditions;
                        reg = /^(abs:)?(.*?)(=\-|~=|=\+|=)(\(?([^ ][\s\S]*?)\)?)?( ([\s\S]*))?$/;
                        if (express_type === 'string') {
                            matches = express.match(reg);
                        } else {
                            matches = express.value.match(reg);
                            conditions = express.conditions;
                        }
                        const abs = matches[1];
                        let path = matches[2];
                        const operator = matches[3];
                        let value = matches[4];
                        const condition = matches[7];
                        const path_extral_match = path.match(/\/\..*$|\.+$|\.\(.*$/);
                        let path_extral;
                        if (path_extral_match) {
                            path_extral = path_extral_match[0];
                            path = path.replace(path_extral, '');
                        }
                        let value_mode;
                        if (express_type === 'string') {
                            const mode_match = value?.match(/^\((.*)\)$/);
                            if (mode_match) {
                                // =('arr_insert',value,0)
                                const mode_info = mode_match[1].split(',');
                                value = mode_info[1];
                                const mode = mode_info[0];
                                mode_info.shift();
                                mode_info.shift();
                                value_mode = {
                                    'mode': mode,
                                    'params': mode_info
                                };
                            }
                            if (condition) {
                                // (fffddf|||ffff)&&&(ffff)
                                const tmp_conditions = condition ? condition.split(this.condition_split_and_tag) : [];
                                conditions = {};
                                for (let index = 0; index < tmp_conditions.length; index++) {
                                    conditions['value' + index] = tmp_conditions[index].split(this.condition_split_or_tag);
                                }
                            }
                        }
                        matches = path.match(/\[([\*\d\-,]*)\]$/);
                        let array_index;
                        if (matches) {
                            path = path.replace(/\[([\*\d\-,]*)\]$/, '');
                            array_index = matches[1];
                        }
                        if (abs) {
                            add_data_to_abs_path({
                                "path": `json_obj${is_array_obj ? '' : '.'}` + path,
                                "express": express,
                                "relative_path": path,
                                "operator": operator,
                                "value": value,
                                "condition": conditions,
                                "array_index": array_index,
                                "path_extral": path_extral,
                                "value_mode": value_mode
                            });
                        } else {
                            const obj_path_match = path.match(/^(.*)\((.*)\)$/);
                            if (obj_path_match) {
                                if (obj_path_match.length !== 3) {
                                    api.apiLog.error('obj_path_match error ', path);
                                    return;
                                }
                                // 赋值给obj
                                add_data_to_abs_path({
                                    "path": obj_path_match[2],
                                    "obj_type": obj_path_match[1],
                                    "express": express,
                                    "relative_path": path,
                                    "operator": operator,
                                    "value": value,
                                    "condition": conditions,
                                    "array_index": array_index,
                                    "path_extral": path_extral,
                                    "value_mode": value_mode
                                });
                                return;
                            }
                            const tmp_short_path = path.split('.').pop();
                            relative_path_info_set.add({
                                "express": express,
                                "path": path,
                                "operator": operator,
                                "value": value,
                                "value_mode": value_mode,
                                "conditions": conditions,
                                "array_index": array_index,
                                "path_extral": path_extral,
                                "short_key": tmp_short_path,
                                "real_key": path,
                                "paths": [] // 存储结果
                            });
                        }
                    });
                    if (relative_path_info_set.size > 0) {
                        obj_property_traverse(json_obj, '', relative_path_info_set, { traverse_all, deep_traverse });
                        for (let real_path_info of relative_path_info_set) {
                            for (let tmp_path of real_path_info.paths) {
                                add_data_to_abs_path({
                                    "path": 'json_obj' + tmp_path,
                                    "express": real_path_info.express,
                                    "relative_path": real_path_info.path,
                                    "operator": real_path_info.operator,
                                    "value": real_path_info.value,
                                    "condition": real_path_info.conditions,
                                    "array_index": real_path_info.array_index,
                                    "path_extral": real_path_info.path_extral,
                                    "value_mode": real_path_info.value_mode
                                });
                            }
                        }
                    }
                    try {
                        this.paths_sort(abs_path_info_list, 'deal_path');
                    } catch (error) {
                        abs_path_info_list.sort((a, b) => a < b ? 1 : -1);
                    }
                    for (let path_info of abs_path_info_list) {
                        if (!this.obj_conditional(path_info, json_obj)) continue;
                        if (this.obj_filter && this.obj_filter(path_info, json_obj)) continue;
                        obj_modify(json_obj, path_info);
                    }
                } catch (error) {
                    api.apiLog.error('obj_process处理失败', error);
                } finally {
                    if (get_value || get_path) {
                        return get_value_results;
                    }
                }

                function add_data_to_abs_path(params) {
                    let { path, express, relative_path, operator, value, condition, array_index, path_extral, value_mode, obj_type } = params;
                    let tmp;
                    path = data_this.convertPathToBracketNotation(path);
                    if (array_index === undefined) {
                        tmp = {};
                        path = path;
                        tmp.path = path;
                        tmp.obj_type = obj_type;
                        tmp.relative_path = relative_path;
                        tmp.operator = operator;
                        tmp.value = value;
                        tmp.value_mode = value_mode;
                        tmp.condition = condition;
                        tmp.path_extral = path_extral;
                        tmp.express = express;
                        add_path(tmp);
                        return;
                    }
                    let array_index_list = [];
                    if (array_index === '*') {
                        let array_length;
                        try {
                            array_length = data_this.string_to_value(json_obj, path)?.length || 0;
                            if (!array_length) return;
                        } catch (error) {
                            api.apiLog.error('obj_process获取数组长度失败--->' + path, error);
                            return;
                        }
                        array_index_list = Array.from({ length: array_length }, (_, i) => i);
                    } else if (array_index.includes(',')) {
                        let is_error = false;
                        array_index_list = array_index.split(',').map(item => {
                            if (is_error) return;
                            if (isNaN(item)) {
                                is_error = true;
                                return;
                            }
                            return Number(item);
                        });
                        if (is_error) {
                            return api.apiLog.error('obj_process数组索引格式错误--->' + path);
                        }
                    } else if (array_index.includes('-')) {
                        const index_arr = array_index.split('-');
                        if (index_arr.length !== 2) return api.apiLog.error('obj_process数组索引格式错误--->' + path);
                        const start = Number(index_arr[0]);
                        const end = Number(index_arr[1]);
                        if (isNaN(start) || isNaN(end)) {
                            return api.apiLog.error('obj_process数组索引格式错误--->' + path);
                        }
                        array_index_list = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                    } else if (!isNaN(array_index)) {
                        array_index_list = [array_index];
                    } else {
                        return api.apiLog.error('obj_process数组索引格式错误--->' + path);
                    }
                    for (let tmp_index = array_index_list.length - 1; tmp_index >= 0; tmp_index--) {
                        tmp = {};
                        tmp.path = path + "[" + array_index_list[tmp_index] + "]";
                        tmp.operator = operator;
                        tmp.value = value;
                        tmp.value_mode = value_mode;
                        tmp.condition = condition;
                        tmp.path_extral = path_extral;
                        tmp.relative_path = relative_path;
                        tmp.express = express;
                        add_path(tmp);
                    }
                    function add_path(path_info) {
                        path_info.deal_path = path_extral ? data_this.get_relative_path(path, path_extral) : path_info.path;
                        abs_path_info_list.push(path_info);
                    }
                }

                function obj_property_traverse(obj, cur_path, serach_infos, { traverse_all = false, deep_traverse = false, contorer = { init: false, deal_sets: null } } = {}) {
                    if (!contorer.init) {
                        contorer.init = true;
                        contorer.deal_sets = new Set(serach_infos);
                    }
                    if (contorer.deal_sets.size === 0) return;
                    if (Array.isArray(obj)) {
                        obj.forEach((tmp_obj, index) => {
                            const tmp_path = `${cur_path}[${index}]`;
                            if (!tmp_obj || typeof (tmp_obj) !== 'object') return;
                            obj_property_traverse(tmp_obj, tmp_path, serach_infos, { traverse_all, deep_traverse, contorer });
                        });
                        return;
                    }
                    for (const key in obj) {
                        const tmp_path = `${cur_path}.${key}`;
                        let processed = false;
                        const matched_infos = [];
                        for (let info of contorer.deal_sets) {
                            if (info.short_key === key) {
                                if (tmp_path.endsWith(info.real_key)) {
                                    info.paths.push(tmp_path);
                                    if (!traverse_all) matched_infos.push(info);
                                    if (contorer.deal_sets.size === matched_infos.length) break;
                                    if (deep_traverse && typeof (obj[key]) === 'object') {
                                        obj_property_traverse(obj[key], tmp_path, serach_infos, { traverse_all, deep_traverse, contorer });
                                    }
                                    processed = true;
                                }
                            }
                        }
                        if (matched_infos.length) {
                            for (const info of matched_infos) contorer.deal_sets.delete(info);
                            if (contorer.deal_sets.size === 0) return;
                        }
                        const value = obj[key];
                        if (processed || typeof (value) !== 'object') continue;
                        obj_property_traverse(value, tmp_path, serach_infos, { traverse_all, deep_traverse, contorer });
                    };
                }

                function obj_modify(json_obj, path_info) {
                    const path = path_info['deal_path'];
                    const operator = path_info['operator'];
                    let value = path_info['value'];
                    let last_obj, last_path, last_key;
                    if (!path_info.obj_type) {
                        const tmp = data_this.get_lastPath_and_key(path);
                        last_path = tmp?.[0];
                        last_key = tmp?.[1];
                        last_obj = data_this.string_to_value(json_obj, last_path);
                        if (!last_obj) {
                            debugger;
                            return api.apiLog.error('obj_modify处理失败，找不到对象--->' + path_info);
                        }
                    }
                    if (operator === '=-') {
                        const is_array = typeof last_key === 'number';
                        if (is_array)
                            last_obj.splice(last_key, 1);
                        else
                            delete last_obj[last_key];
                        api.apiLog.info('依据：' + path_info.express, 'obj_process');
                        api.apiLog.info('删除属性-->' + path, 'obj_process');
                        return;
                    }
                    if (operator === '=') {
                        value = data_this.value_parse(value, path_info, json_obj);
                        if (path_info.obj_type) {
                            if (path_info.obj_type === 'sObj') {
                                data_this[path_info.path] = value;
                            }
                            if (path_info.obj_type === 'global') {
                                unsafeWindow[path_info.path] = value;
                            }
                        } else {
                            last_obj[last_key] = value;
                        }
                        api.apiLog.info('依据：' + path_info.express, 'obj_process');
                        api.apiLog.info('修改属性-->' + path, 'obj_process');
                        return;
                    }
                    const dec_obj = last_obj[last_key];
                    if (!dec_obj) {
                        return api.apiLog.error('obj_modify处理失败，找不到对象--->' + path_info);
                    }
                    if (operator === '=+') {
                        value = data_this.value_parse(value, path_info, json_obj);
                        if (dec_obj === null || dec_obj === undefined) throw new Error('dec_obj is null');
                        let type_ = typeof dec_obj;
                        if (Array.isArray(dec_obj)) type_ = 'array';
                        if (type_ === 'array') {
                            const mode_info = path_info.value_mode;
                            if (mode_info) {
                                try {
                                    mode_info.mode === 'arr_insert' && last_obj[last_key].splice(Number(mode_info.params[0]), 0, value);
                                } catch (error) {
                                    api.apiLog.error(error);
                                }
                            } else {
                                last_obj[last_key].push(value);
                            }
                        }
                        if (type_ === 'string' || type_ === 'number') last_obj[last_key] = last_obj[last_key] + value;
                        api.apiLog.info('依据：' + path_info.express, 'obj_process');
                        api.apiLog.info('修改属性-->' + path, 'obj_process');
                    }
                    if (operator === '~=') {
                        const search_value = value.split(SPLIT_TAG)[0];
                        const replace_value = value.split(SPLIT_TAG)[1];
                        last_obj[last_key] = dec_obj.replace(new RegExp(search_value, 'g'), replace_value);
                        api.apiLog.info('依据：' + path_info.express, 'obj_process');
                        api.apiLog.info('修改属性-->' + path, 'obj_process');
                    }
                }
            }

            path_process(json_obj, path) {
                if (path.includes('[-')) {
                    const match = path.match(/\[(-\d+)\]/);
                    const index = parseInt(match[1]);
                    const dec_obj_path = path.slice(0, match.index);
                    const array_length = this.string_to_value(json_obj, dec_obj_path + '["length"]');
                    if (!array_length) return path;
                    const real_index = array_length + index;
                    path = path.replace(`[${index}`, `[${real_index}`);
                    return this.path_process(json_obj, path);
                }
                return path;
            }

            value_conditional(value, condition_express) {
                const reg = /(\$text|\$value|\$exist|\$notexist)?((>=|<=|>|<|!~=|!=|~=|=))?(.*)/;
                const match = condition_express.match(reg);
                const condition_type = match[1] || '$text';
                const condition_operator = match[2];
                const condition_test_value = match[4];
                const operator_reg = /(>=|<=|>|<|!~=|!=|~=|=)?(.*)$/;
                if (condition_type === '$value') {
                    // $value=1|2 或 $value>=1&2
                    if (!['>=', '<=', '>', '<', '='].includes(condition_operator)) return false;
                    const split_tag = condition_test_value.includes(this.value_split_or_tag) && this.value_split_or_tag || this.value_split_and_tag;
                    const condition_test_value_arr = condition_test_value.split(split_tag);
                    let result;
                    for (let test_value of condition_test_value_arr) {
                        const operator_match = test_value.match(operator_reg);
                        const operator = operator_match && operator_match[1] || condition_operator;
                        test_value = operator_match && operator_match[2];
                        if (isNaN(test_value)) {
                            if (split_tag === this.value_split_and_tag) return false; else continue;
                        };
                        test_value = parseInt(test_value);
                        if (operator === '=') result = test_value === value;
                        if (operator === '>=') result = value >= test_value;
                        if (operator === '<=') result = value <= test_value;
                        if (operator === '>') result = value > test_value;
                        if (operator === '<') result = value < test_value;
                        if (!result) {
                            if (split_tag === this.value_split_and_tag) return false; else continue;
                        };
                        return true;
                    }
                }
                if (condition_type === '$exist') {
                    return value !== undefined && value !== null;
                }
                if (condition_type === '$notexist') {
                    return value === undefined || value === null;
                }
                if (condition_type === '$text') {
                    let split_tag;
                    let condition_test_value_arr;
                    if (['!~=', '~='].includes(condition_operator)) {
                        split_tag = this.value_split_and_tag;
                        condition_test_value_arr = [condition_test_value];
                    } else {
                        split_tag = condition_test_value.includes(this.value_split_or_tag) && this.value_split_or_tag || this.value_split_and_tag;
                        condition_test_value_arr = condition_test_value.split(split_tag);
                    }
                    let result;
                    if (typeof (value) === 'object') value = JSON.stringify(value);
                    for (let test_value of condition_test_value_arr) {
                        const operator_match = test_value.match(operator_reg);
                        const operator = operator_match && operator_match[1] || condition_operator;
                        test_value = operator_match && operator_match[2] || test_value;
                        if (operator === '!=') result = test_value !== value;
                        if (operator === '=') result = test_value === value;
                        if (operator === '~=') result = new RegExp(test_value).test(value);
                        if (operator === '!~=') result = !new RegExp(test_value).test(value);
                        if (operator === '>=') result = value.length >= test_value.length;
                        if (operator === '>') result = value.length > test_value.length;
                        if (operator === '<=') result = value.length <= test_value.length;
                        if (operator === '>') result = value.length > test_value.length;
                        if (!result) {
                            if (split_tag === this.value_split_and_tag) return false; else continue;
                        };
                        return true;
                    }
                }
                return false;
            }

            obj_conditional(express_info, json_obj) {
                //json_obj 在eval里直接调用
                if (!express_info['condition']) return true;
                const condition_infos = express_info['condition'];
                // 与 
                for (let condition_list of Object.values(condition_infos)) {
                    let result = false;
                    for (let condition of condition_list) {
                        const reg = /^([a-zA-Z_0-9\/\-\.@\[\]]*)?(.*)/;
                        const match = condition.match(reg);
                        let condition_path = match[1];
                        let mod;
                        if (condition_path) {
                            if (condition_path.startsWith('/')) {
                                mod = 'child';
                            } else if (condition_path.startsWith('.')) {
                                mod = 'parent';
                            } else if (condition_path.startsWith('@')) {
                                mod = 'global';
                            } else {
                                mod = 'other';
                            }
                        } else {
                            condition_path = express_info.path;
                        }
                        const conditional_express = match[2];
                        if (['child', 'parent'].includes(mod)) {
                            // child   /.a.b.c path相对路径
                            // parent  ..a.b.c path相对路径
                            condition_path = this.get_relative_path(express_info.path, condition_path);
                        }
                        if (mod === 'other') {
                            // json_obj里的绝对路径
                            condition_path = this.get_relative_path('json_obj', '/.' + condition_path);
                        }
                        if (mod === 'global') {
                            // 提取全局里的数据
                            // condition_path = condition_path.replace('@', this.limit_eval ? 'unsafeWindow.' : '');
                            condition_path = condition_path.replace('@', '');
                        }
                        let condition_value;
                        try {
                            condition_path = this.path_process(json_obj, condition_path);
                            condition_value = this.string_to_value(mod === 'global' ? unsafeWindow : json_obj, condition_path);
                        } catch (error) {
                            continue;
                        }
                        result = this.value_conditional(condition_value, conditional_express);
                        if (result) {
                            express_info.condition_value = condition_value;
                            express_info.conform_value_path = condition_path;
                            api.apiLog.info('条件成立-->', condition, typeof condition_value === 'object' ? '[object Object]' : condition_value, 'obj_process');
                            break;
                        }
                    }
                    if (!result) return false;
                }
                return true;
            }
        }
        api.data.dataProcess = new DATA_PROCESS();
    }
    
    
    // 初始化所有API
    utilsApiInit();
    domApiInit()
    eventApiInit()
    dataApiInit()
    netApiInit()
    animateApiInit()
    // 返回API对象
    return api;
}
})();
