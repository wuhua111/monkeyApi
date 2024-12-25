/**
 * QuicklyModelCore 类
 * 版本: 1.0.4
 * 作者: hua
 */

class QuicklyModelCore {
    constructor(options = {}) {
        this.version = '1.0.4';
        this.initConfig(options);
        this.initModules();
        this.utils.apiLog.info('Api已加载 版本号:', this.version);
        this.utils.apiLog.info('当前URL:', location.href);
    }

    initConfig(options) {
        // 默认启用的监控功能
        // createElement: 创建DOM元素
        // iframe: iframe相关功能
        // fetch: fetch请求拦截
        // xhr: XMLHttpRequest拦截
        // request: Request拦截

        // 默认关闭监控的功能
        // webSocket: WebSocket拦截
        // worker: Worker拦截
        // dyncFileLoad: 动态文件加载拦截
        // json: JSON数据处理
        // sessionStorage
        // localStorage
        // message: 消息通信
        // open: 打开新窗口
        // addEventListener: 事件监听
        // setTimeout: setTimeout拦截
        // setInterval: setInterval拦截
        // eval: eval拦截
        // date: Date拦截
        // promise: Promise拦截
        // canvas: Canvas拦截
        // random: Math.random拦截
        // setAttribute: 拦截setAttribute 返回false 拦截
        // webpack: webpack拦截 需要config里通过webpack属性传入一个webpack具体名称 
        const defaultEnable = new Set(['createElement', 'iframe', 'fetch', 'xhr', 'request']);

        // 处理enable选项
        if (options.enable) {
            options.enable.forEach((item) => defaultEnable.add(item));
            delete options.enable;
        }

        // 处理disable选项
        if (options.disable) {
            options.disable.forEach((item) => defaultEnable.delete(item));
            delete options.disable;
        }

        // 合并配置
        this.config = {
            dev: false,
            enable: defaultEnable,
            ...options
        };
    }

    initModules() {
        // 初始化工具模块
        this.utils = new UtilsModule(this);

        // 初始化核心功能模块
        this.dom = new DOMModule(this);
        this.event = new EventModule(this);
        this.net = new NetworkModule(this);
        this.animate = new AnimateModule(this);
        this.data = new DataModule(this);
        this.date = new DateModule(this);
        this.other = new OtherModule(this);

        // 开发模式下添加调试工具
        if (this.config.dev) {
            unsafeWindow.debug_ = this.utils.debugHelper;
        }
    }
}

/**
 * 基础模块类
 * 所有功能模块继承自此类
 */
class BaseModule {
    constructor(core) {
        this.core = core;
        this.config = core.config;
        this.utils = core.utils; // 工具模块引用
        this.factory = this.utils?.factory;
    }

    // 检查功能是否启用
    isEnabled(feature) {
        return this.config.enable.has(feature);
    }

    // 日志记录
    info(...args) {
        this.core.utils.apiLog.info(...args);
    }

    error(...args) {
        this.core.utils.apiLog.error(...args);
    }

    warn(...args) {
        this.core.utils.apiLog.warn(...args);
    }
}

/**
 * 工具模块
 * 提供基础工具函数和服务
 */
class UtilsModule extends BaseModule {
    constructor(core) {
        super(core);
        this.initFactory();
        this.initLogger();
        this.initSecurity();
        this.initType();
        this.initOrigin();
        this.initDebugHelper();
        this.initCookie();
        this.initUrl();


        // 其他工具属性
        this.ua = unsafeWindow.navigator.userAgent;
        this.console = unsafeWindow.console;
    }

    initFactory() {
        const localContext = this;
        this.createApiFactory = function () {
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
                                return localContext.error(error);
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
                                    localContext.error(`${name} global callback error`, error);
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
                                localContext.error('callback error', error);
                            }
                            return res;
                        };
                        if (options.debounceTime > 0) {
                            debounceTimeoutId = setTimeout(executeCallback, options.debounceTime);
                            return;
                        }
                        if (options.timeout > 0) {
                            timeoutId = setTimeout(() => {
                                localContext.warn(`Callback execution for "${name}" timed out`);
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
                                    localContext.error(`${name} uniqueMode must be "replace" or "none"`);
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
                        localContext.error(`${name} global unsubscribe error`, error);
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
                                localContext.error(`${name} globalModify error`, error);
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
        };

        this.factory = this.createApiFactory();
    }

    initLogger() {
        const localContext = this;
        this.Logger = class Logger {
            constructor(options = {}) {
                const { moduleName = '', ...otherOptions } = options;
                this.options = {
                    enabled: true, // 是否启用日志
                    prefix: '[Logger]', // 日志前缀
                    showTimestamp: true, // 是否显示时间戳
                    showTrace: true, // 是否显示错误追踪
                    maxLogLength: 1000, // 单条日志最大长度
                    showInConsole: true, // 是否在控制台显示
                    showLevel: 1, // 是否显示级别
                    maxLogStorage: 1000, // 最大存储日志条数
                    levels: {
                        DEBUG: { name: 'DEBUG', color: '#7f8c8d', value: 1 },
                        INFO: { name: 'INFO', color: '#2ecc71', value: 2 },
                        WARN: { name: 'WARN', color: '#f1c40f', value: 3 },
                        ERROR: { name: 'ERROR', color: '#e74c3c', value: 4 }
                    },
                    ...otherOptions
                };
                // 如果提供了模块名,添加到前缀中
                if (moduleName) {
                    this.options.prefix = `${this.options.prefix}[${moduleName}]`;
                }
                // 日志存储
                this.logStorage = [];
            }
            _log(level, ...args) {
                if (this.options.levels[level].value < this.options.showLevel) return;
                // 处理日志内容
                let logContent = args.map(arg => {
                    if (arg instanceof Error) {
                        // 专门处理 Error 对象
                        return `${arg.name}: ${arg.message}\nStack: ${arg.stack}`;
                    }
                    if (typeof arg === 'object') {
                        try {
                            return JSON.stringify(arg);
                        } catch (e) {
                            return arg.toString();
                        }
                    }
                    return arg;
                }).join(' ');
                // 截断过长日志
                if (logContent.length > this.options.maxLogLength) {
                    logContent = logContent.substring(0, this.options.maxLogLength) + '...';
                }
                // 构建日志前缀
                const parts = [this.options.prefix];
                if (this.options.showTimestamp) {
                    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
                    parts.push(`[${timestamp}]`);
                }
                parts.push(`[${level}]`);
                const prefix = parts.join('');
                const style = `color: ${this.options.levels[level].color}; font-weight: bold;`;
                // 保存日志
                this.logStorage.push({
                    timestamp: new Date(),
                    level,
                    prefix,
                    content: logContent
                });
                // 控制日志存储大小
                if (this.logStorage.length > this.options.maxLogStorage) {
                    this.logStorage.shift();
                }
                // 输出日志到控制台
                if (this.options.showInConsole) {
                    localContext.console.log(`%c${prefix}`, style, logContent);

                    // 错误追踪
                    if (level === 'ERROR' && this.options.showTrace) {
                        localContext.console.trace();
                    }
                }
            }
            debug(...args) {
                this._log('DEBUG', ...args);
            }
            info(...args) {
                this._log('INFO', ...args);
            }
            warn(...args) {
                this._log('WARN', ...args);
            }
            error(...args) {
                this._log('ERROR', ...args);
            }
            // 工具方法
            setEnabled(enabled) {
                this.options.enabled = enabled;
            }
            setShowInConsole(show) {
                this.options.showInConsole = show;
            }
            setLevel(level, show) {
                if (this.options.levels[level]) {
                    this.options.levels[level].show = show;
                }
            }
            setAllLevels(show) {
                Object.keys(this.options.levels).forEach(level => {
                    this.options.levels[level].show = show;
                });
            }
            // 日志获取方法
            getLogs(options = {}) {
                const {
                    level,
                    startTime,
                    endTime,
                    search,
                    limit
                } = options;
                let filteredLogs = this.logStorage;
                // 按级别筛选
                if (level) {
                    filteredLogs = filteredLogs.filter(log => log.level === level);
                }
                // 按时间范围筛选
                if (startTime) {
                    filteredLogs = filteredLogs.filter(log => log.timestamp >= startTime);
                }
                if (endTime) {
                    filteredLogs = filteredLogs.filter(log => log.timestamp <= endTime);
                }
                // 按内容搜索
                if (search) {
                    const searchLower = search.toLowerCase();
                    filteredLogs = filteredLogs.filter(log =>
                        log.content.toLowerCase().includes(searchLower)
                    );
                }
                // 限制返回数量
                if (limit) {
                    filteredLogs = filteredLogs.slice(-limit);
                }
                return filteredLogs;
            }
            // 清除日志
            clearLogs() {
                this.logStorage = [];
            }
        };

        this.apiLog = new this.Logger({
            moduleName: 'API',
            showLevel: this.config.dev ? 1 : 3
        });
    }

    initSecurity() {
        this.security = {
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
                            createScript: function (scriptText) {
                                return scriptText;
                            }
                        });
                        return function (scriptText) {
                            return policy.createScript(scriptText);
                        };
                    } else {
                        return function (text) {
                            return text;
                        };
                    }
                }
            })()
        };
    }

    initType() {
        this.type = {
            isClassInstance: (obj) => {
                return obj !== null
                    && typeof obj === 'object'
                    && obj.constructor !== Object;
            },
            isNative: (name, fun) => {
                const fun_str = fun.toString();
                if (!this.ua.includes('Firefox')) {
                    return `function ${name}() { [native code] }` === fun_str;
                } else {
                    return `function ${name}() {\n    [native code]\n}` === fun_str;
                }
            }
        };
    }

    initOrigin() {
        const localContext = this;
        this.origin = {
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
                if (typeof originFun === 'function' && !localContext.type.isNative(lastProp, originFun)) {
                    localContext.warn(`${lastProp} have been modified`);
                }
                if (typeof value !== 'function' && !localContext.type.isClassInstance(value)) {
                    const descriptor = value;
                    localContext.defineProperty(dec, lastProp, descriptor);
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
        };
    }

    initDebugHelper() {
        this.debugHelper = {
            analyzeObject: (obj, objName = 'object') => {
                const properties = Object.getOwnPropertyNames(obj);
                if (properties.length === 0) {
                    this.info('对象没有属性');
                    return;
                };
                this.console.group(`分析对象: ${objName}`);
                properties.forEach(prop => {
                    try {
                        const value = obj[prop];
                        const type = typeof value;
                        this.console.group(`属性: ${prop} (类型: ${type})`);
                        switch (type) {
                            case 'function':
                                // 输出函数定义
                                this.console.log('函数定义:', value.toString());
                                // 尝试执行函数
                                try {
                                    const result = value.call(obj);
                                    this.console.log('执行结果:', result);
                                } catch (execError) {
                                    this.console.error('函数执行失败:', execError.message);
                                }
                                break;
                            case 'object':
                                if (value === null) {
                                    this.console.log('值: null');
                                } else {
                                    try {
                                        this.console.log('JSON表示:', JSON.stringify(value, null, 2));
                                    } catch (jsonError) {
                                        this.console.error('无法转换为JSON:', jsonError.message);
                                        this.console.log('原始值:', value);
                                    }
                                }
                                break;
                            default:
                                this.console.log('值:', value);
                        }

                        this.console.groupEnd();
                    } catch (error) {
                        this.console.error(`无法访问属性 ${prop}:`, error.message);
                    }
                });
                this.console.groupEnd();
            }
        };
    }

    // 工具方法
    defineProperty(obj, property, descriptor) {
        const old_descriptor = Object.getOwnPropertyDescriptor(obj, property);
        if (old_descriptor?.configurable === false) {
            if (old_descriptor.writable === false) {
                this.error(property, 'is not configurable and not writable !', old_descriptor);
                return;
            } else {
                if (descriptor.value) {
                    obj[property] = descriptor.value;
                    if (descriptor.configurable === false) {
                        this.warn(property, 'is not configurable ! but can set value !', old_descriptor);
                    }
                    return;
                }
                this.error(property, 'is not configurable , but can set value ! ', old_descriptor);
            }
        }
        Object.defineProperty(obj, property, descriptor);
    }

    hookGlobalObjectPrototypeName(propertyName, descriptor) {
        this.defineProperty(Object.prototype, propertyName, descriptor);
    }

    randomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    initCookie() {
        this.cookie = {
            get: (cookieName) => {
                if (!cookieName) return document.cookie;
                const name = cookieName + "=";
                let decodedCookie;
                try {
                    decodedCookie = decodeURIComponent(document.cookie);
                } catch (error) {
                    this.error('cookie decode error');
                    return null;
                }
                const cookieArray = decodedCookie.split(';');
                for (let i = 0; i < cookieArray.length; i++) {
                    const cookie = cookieArray[i].trim();
                    if (cookie.startsWith(name)) {
                        return cookie.substring(name.length, cookie.length);
                    }
                }
                return null;
            },
            set: (cookieName, cookieValue, cookieOptions) => {
                document.cookie = `${cookieName}=${cookieValue}; ${cookieOptions}`;
            },
            delete: (cookieName) => {
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            }
        };
    }

    initUrl() {
        this.url = {
            paramsParse: (url) => {
                if (!url) return {};
                if (typeof url === 'object') url = url.url;
                if (typeof url !== 'string') return {};
                const uri = url.split('?')[0];
                if (url.startsWith('//')) url = 'https:' + url;
                if (url.startsWith('/')) url = unsafeWindow.location.origin + url;
                try {
                    const searchParams = new URLSearchParams(new URL(url).search);
                    const params = {};
                    for (const [key, value] of searchParams) {
                        params[key] = value;
                    }
                    return {
                        params,
                        uri
                    };
                } catch (error) {
                    this.error('urlParamsParse error', error);
                    return {
                        params,
                        uri
                    };
                }
            },
            paramsMerge: (url, params) => {
                return url + '?' + new URLSearchParams(params).toString();
            }
        };
    }
}

/**
 * DOM模块
 * 处理DOM相关操作
 */
class DOMModule extends BaseModule {
    constructor(core) {
        super(core);
        this.initQuery();

        // 根据配置初始化功能
        if (this.isEnabled('createElement')) {
            this.initCreateElement();
        }

        if (this.isEnabled('iframe')) {
            this.initIframe();
        }

        if (this.isEnabled('setAttribute')) {
            this.initSetAttribute();
        }

        this.initWaitElement();
    }

    initQuery() {
        this.query = {
            $: unsafeWindow.document.querySelector.bind(unsafeWindow.document),
            $$: unsafeWindow.document.querySelectorAll.bind(unsafeWindow.document)
        };
    }

    initCreateElement() {
        const localContext = this;
        this.createElement = this.factory('createElement');

        const origin_createElement = unsafeWindow.document.createElement;
        const fakeCreateElement = function (tag, options) {
            let node = origin_createElement.call(this, tag, options);
            localContext.createElement.trigger(this, node, tag, options);
            return node;
        };

        this.utils.origin.hook('document.createElement', fakeCreateElement);
    }

    initSetAttribute() {
        const localContext = this;
        this.setAttribute = this.factory('setAttribute', { modify: 0 }, { stopPropagation: true, modify: 0 });
        const originSetattribute = unsafeWindow.Element.prototype.setAttribute;
        const fakeSetattribute = function (name, value) {
            value = localContext.setAttribute.trigger(this, value, name);
            if (value === false) return;
            originSetattribute.call(this, name, value);
        };
        this.utils.origin.hook('Element.prototype.setAttribute', fakeSetattribute);
    }

    initIframe() {
        const localContext = this;
        if (!this.isEnabled('createElement')) {
            this.warn('createElement 未启用,iframe 功能将无法正常使用');
            return;
        }

        this.iframe = {
            oncreate: this.factory('frameOncreate'),
            contentWindow: this.factory('frameOnget'),
        };

        this.createElement.subscribe((node) => {
            this.iframe.oncreate.trigger(node);
            const contentWindow_getter = Object.getOwnPropertyDescriptor(
                HTMLIFrameElement.prototype,
                "contentWindow"
            ).get;

            this.utils.defineProperty(node, 'contentWindow', {
                get: function () {
                    const contentWindow = contentWindow_getter.call(node);
                    delete node.contentWindow;
                    if (!contentWindow || this.src !== 'about:blank') return contentWindow;
                    localContext.iframe.contentWindow.trigger(this, contentWindow, node);
                    return contentWindow;
                },
                configurable: true
            });
        }, {
            condition: (_, tag) => tag === 'iframe'
        });
    }

    initWaitElement() {
        /**
        * 等待元素出现
        * @param {Node} observeNode 要观察的节点
        * @param {Function} condition 条件函数,返回true表示找到目标元素
        * @param {Object} options 配置选项
        * @param {number} options.timeout 超时时间,默认10000ms
        * @param {string} options.type 监听类型,'add'(新增)/'remove'(删除)/'none'(自定义),默认'add'
        * @param {Object} options.observeOptions MutationObserver的配置项
        * @returns {Promise<Node>} 返回找到的元素节点
        */
        this.waitElement = (observeNode, condition, options = {}) => {
            if (!observeNode || observeNode?.nodeType !== 1) {
                return Promise.reject('waitElement observeNode error');
            }

            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                const {
                    timeout = 10000,
                    type = 'add',
                    observeOptions = { childList: true, subtree: true }
                } = options;

                const monitor = new MutationObserver((mutationsList) => {
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
                        if (mutation.type === 'childList') {
                            let decNodes = [];
                            if (type === 'add') {
                                decNodes = mutation.addedNodes || [];
                            } else if (type === 'remove') {
                                decNodes = mutation.removedNodes || [];
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
        };

        /**
         * 等待元素渲染完成
         * @param {Node} decNode 要观察的节点
         * @param {string} expression 匹配表达式
         * @param {Object} options 配置选项
         * @param {number} options.timeout 超时时间,默认10000ms
         * @param {string} options.type 匹配类型,'selector'/'class'/'id'/'name'/'tag',默认'selector'
         * @returns {Promise<Node>} 返回找到的元素节点
         */
        this.waitForRender = (decNode, expression, options = {}) => {
            const { timeout = 10000, type = 'selector' } = options;

            if (!['selector', 'class', 'id', 'name', 'tag'].includes(type)) {
                return Promise.reject('waitForRender type error');
            }

            return this.waitElement(decNode, (node) => {
                this.log('waitForRender', node);
                if (type === 'selector') return node.querySelector(expression);
                if (type === 'class') return node.classList?.contains(expression);
                if (type === 'id') return node.id === expression;
                if (type === 'name') return node.name === expression;
                if (type === 'tag') return node.tagName === expression;
                return false;
            }, { timeout });
        };
    }
}

/**
 * 事件模块
 * 处理事件相关操作
 */
class EventModule extends BaseModule {
    constructor(core) {
        super(core);
        this.initDOMContentLoaded();
        this.initUrlChange();

        if (this.isEnabled('addEventListener')) {
            this.initEventListener();
        }

        if (this.isEnabled('message')) {
            if (!this.isEnabled('addEventListener')) {
                this.error('open hook message need addEventListener');
                return;
            }
            this.initMessage();
        }

        if (this.isEnabled('open')) {
            this.initWinOpen();
        }

        if (this.isEnabled('eval')) {
            this.initEval();
        }

    }

    initDOMContentLoaded() {
        // DOM加载完成事件
        this.domContentLoaded = this.factory('domContentLoaded');
        unsafeWindow.document.addEventListener('DOMContentLoaded', () => {
            this.domContentLoaded.trigger(this);
        });
    }

    initUrlChange() {
        // URL变化监听
        this.urlChange = this.factory('urlChange');

        const setHistoryHook = (window_obj) => {
            const wrap = (type) => {
                const origin = window_obj.history[type];
                return async function () {
                    let rv;
                    try {
                        rv = origin.apply(this, arguments);
                    } catch (error) {
                        this.error('history hook error', error);
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
            window_obj.addEventListener('popstate', (event) => urlChange(event));
            window_obj.addEventListener('hashchange', (event) => urlChange(event));
        };

        let href = unsafeWindow.location.href;
        const urlChange = (event = null) => {
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
                    if (destination_url.startsWith('/')) {
                        destination_url = unsafeWindow.location.origin + destination_url;
                    } else {
                        destination_url = unsafeWindow.location.origin + '/' + destination_url;
                    }
                }
            } else {
                destination_url = event;
            }
            if (!destination_url.startsWith('http')) return;
            if (destination_url === href) return;
            const oldHref = href;
            href = destination_url || unsafeWindow.location.href;
            this.urlChange.trigger(this, href, oldHref);
        };

        setHistoryHook(unsafeWindow);
    }

    initEventListener() {
        const localContext = this;
        this.addEventListener = this.factory('addEventListener', { modify: [0, 1] }, { stopPropagation: true, modify: [0, 1] });
        const origin_addEventListener = unsafeWindow.addEventListener;
        const fakeAddEventListener = function (tag, fun, options) {
            [tag, fun, options] = localContext.addEventListener.trigger(this, tag, fun, options);
            return origin_addEventListener.call(this, tag, fun, options);
        };
        this.utils.origin.hook('addEventListener', fakeAddEventListener);
    }

    initMessage() {
        const localContext = this;
        this.message = {
            onMessage: this.factory('messageOnMessage'),
            postMessage: this.factory('postMessage', { modify: [0, 1] }, { stopPropagation: true, modify: [0, 1] })
        };

        const origin_postMessage = unsafeWindow.postMessage;
        const fakePostMessage = function (message, targetOrigin, transfer) {
            [message, targetOrigin] = localContext.message.postMessage.trigger(this, message, targetOrigin);
            const args = [message];
            if (targetOrigin) args.push(targetOrigin);
            if (transfer) args.push(transfer);
            return origin_postMessage.call(this, ...args);
        };

        this.utils.origin.hook('postMessage', fakePostMessage);

        const fakeOnMessage = function (event) {
            const res = localContext.message.onMessage.trigger(this, event);
            if (res !== false) return;
            event.stopPropagation();
            event.stopImmediatePropagation();
        };

        unsafeWindow.addEventListener('message', fakeOnMessage, { capture: true, priority: true });

        this.addEventListener.subscribe((tag, fun, options) => {
            if (!options) return;
            options.capture = false;
            options.priority = false;
        }, { condition: tag => tag === 'message' });
    }

    initWinOpen() {
        const localContext = this;
        this.winOpen = this.factory('winOpen', { modify: 0 }, { stopPropagation: true, modify: 0 });
        const origin_open = unsafeWindow.open;
        const fakeOpen = function (url, target, features, replace) {
            if (!url) url = "about:blank";
            url = localContext.winOpen.trigger(this, url, target, features, replace);
            if (!url) return;
            return origin_open.call(this, url, target, features, replace);
        };
        this.utils.origin.hook('open', fakeOpen);
    }

    initEval() {
        const localContext = this;
        this.eval = this.factory('eval', { modify: 0 }, { stopPropagation: true, modify: 0 });
        const origin_eval = unsafeWindow.eval;
        const fakeEval = function (code) {
            code = localContext.eval.trigger(this, code);
            if (!code) return;
            return origin_eval.call(this, code);
        };
        this.utils.origin.hook('eval', fakeEval);
    }

    // 双击处理
    /**
     * 双击处理API
     * 用于处理节点的双击事件,同时保留单击事件的功能
     * @param {HTMLElement} node - 需要处理双击事件的DOM节点
     * @param {Function} handler - 双击事件的处理函数
     * @param {number} [timeout=300] - 判定双击的时间间隔(毫秒)
     * @returns {Object} 返回一个包含set方法的对象
     * @property {Function} set - 设置双击事件处理
     * @throws {Error} 当node参数不是有效的DOM节点时抛出错误
     * @example
     * // 基础用法
     * const node = document.querySelector('#myElement');
     * this.dbClickAPI(node, (e) => {
     *   console.log('双击事件触发');
     * });
     * 
     * // 自定义超时时间
     * this.dbClickAPI(node, handler, 500);
     * 
     * @description
     * 特殊说明:
     * 1. 处理对应的node后，会导致事件无法下发到该node子节点，所以要保证，该node下没有点击事件
     */
    dbClickAPI(node, handler, timeout = 300) {
        if (!node || node?.nodeType !== 1) return Promise.reject('getDbclickAPI node error');
        if (node.inject_dbclick) return;
        node.inject_dbclick = true;

        let isClick = false;
        let timers = new Set();
        const originOnclick = node.onclick;

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
            // 不要阻止事件，而是克隆它

            const timer = setTimeout(() => {
                isClick = true;
                clearAllTimers();
                node.dispatchEvent(e);
            }, timeout);

            timers.add(timer);

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };

        const dblclickHandler = (e) => {
            e.preventDefault();
            clearAllTimers();
            handler.call(node, e);
        };

        return {
            start: () => {
                node.onclick = null;
                const eventOptions = {
                    capture: true,
                    passive: false
                };

                node.addEventListener('click', fakeOnclick, eventOptions);
                node.addEventListener('dblclick', dblclickHandler, eventOptions);
            },
            close: () => {
                clearAllTimers();
                node.onclick = originOnclick;

                node.removeEventListener('click', fakeOnclick);
                node.removeEventListener('dblclick', dblclickHandler);

                delete node.inject_dbclick;
            }
        };
    }
}

/**
 * 日期时间模块
 * 处理日期相关操作
 */
class DateModule extends BaseModule {
    constructor(core) {
        super(core);

        if (this.isEnabled('date')) {
            this.initDate();
        }

        if (this.isEnabled('setTimeout')) {
            this.initSetTimeout();
        }

        if (this.isEnabled('setInterval')) {
            this.initSetInterval();
        }
    }

    initDate() {
        const localContext = this;
        this.date = this.factory('date', {}, { stopPropagation: true });
        class fakeDate extends Date {
            constructor(...args) {
                localContext.date.trigger(null, 'constructor', args);
                super(...args);
            }
            now() {
                const now = localContext.date.trigger(this, 'now');
                return now || super.now();
            }
        }
        this.utils.origin.hook('Date', fakeDate);
    }

    initSetTimeout() {
        const localContext = this;
        this.setTimeout = this.factory('setTimeout', { modify: [0, 1] }, { stopPropagation: true, modify: [0, 1] });
        const origin_setTimeout = unsafeWindow.setTimeout;
        const fakeSetTimeout = function (fun, delay, ...args) {
            [fun, delay] = localContext.setTimeout.trigger(this, fun, delay, ...args);
            return origin_setTimeout.call(this, fun, delay, ...args);
        };
        this.utils.origin.hook('setTimeout', fakeSetTimeout);
    }

    initSetInterval() {
        const localContext = this;
        this.setInterval = this.factory('setInterval', { modify: [0, 1] }, { stopPropagation: true, modify: [0, 1] });
        const origin_setInterval = unsafeWindow.setInterval;
        const fakeSetInterval = function (fun, delay, ...args) {
            [fun, delay] = localContext.setInterval.trigger(this, fun, delay, ...args);
            return origin_setInterval.call(this, fun, delay, ...args);
        };
        this.utils.origin.hook('setInterval', fakeSetInterval);
    }
}

/**
 * 网络模块
 * 处理网络请求相关操作
 */
class NetworkModule extends BaseModule {
    constructor(core) {
        super(core);

        if (this.isEnabled('fetch')) {
            this.initFetch();

            if (this.isEnabled('request')) {
                this.initRequest();
            } else if (this.isEnabled('request2')) {
                this.initRequest2();
            }
        }

        if (this.isEnabled('xhr')) {
            this.initXHR();
        }

        if (this.isEnabled('webSocket')) {
            this.initWebSocket();
        }

        if (this.isEnabled('dyncFileLoad')) {
            if (!this.isEnabled('createElement')) {
                this.error('open hook dyncFileLoad need createElement');
                return;
            }
            this.initDyncFileLoad();
        }

        // iframe contentWindow hook
        if (this.isEnabled('iframe')) {
            if (!this.isEnabled('createElement')) {
                this.error('open hook iframe need createElement');
                return;
            }
            this.core.dom.iframe.contentWindow.subscribe((contentWindow) => {
                this.utils.origin.injiect(contentWindow);
            });
        }
    }

    initFetch() {
        const localContext = this;
        this.fetch = {
            request: this.factory('fetchRequest', { modify: 0 }, { stopPropagation: true, modify: 0 }),
            response: this.factory('fetchResponse', { modify: 0 }, { stopPropagation: true, modify: 0 }),
        };
        this.fetch.response.json = this.factory('fetchResponseJson', {}, { stopPropagation: true });
        this.fetch.response.text = this.factory('fetchResponseText', { modify: 0 }, { modify: 0, stopPropagation: true, });
        this.fetch.response.commonTextToJsonProcess = this.factory('commonTextToJsonProcess', {}, { stopPropagation: true, });
        this.fetch.response.processJson = function (json, rule, { traverse_all = false } = {}) {
            rule && localContext.data.dataProcess.obj_process(json, rule, { traverse_all });
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
                            const options = { body: uri.body_, params: localContext.utils.url.paramsParse(url) };
                            text = localContext.fetch.response.text.trigger(this, text, url, options);
                            if (text instanceof Promise) text = await text;
                            if (localContext.fetch.response.commonTextToJsonProcess.matchCallbackNum(this, null, url, options)) {
                                let json = JSON.parse(text);
                                localContext.fetch.response.commonTextToJsonProcess.trigger(this, json, url, options);
                                text = JSON.stringify(json);
                            }
                        } catch (error) {
                            localContext.error('fetch response text error', error);
                            text = save;
                        }
                        return text;
                    };
                    const cloneResponse = response.clone();
                    const originJson = response.json.bind(response);
                    response.json = async function () {
                        let json = await originJson();
                        try {
                            localContext.fetch.response.json.trigger(this, json, url, options);
                        } catch (error) {
                            localContext.error('fetch response json error', error);
                            json = await cloneResponse.json();
                        }
                        return json;
                    };
                    response = localContext.fetch.response.trigger(this, response, url, options);
                    return response;
                }
                let req;
                try {
                    if (!uri) {
                        uri = unsafeWindow.location.href;
                    }
                    if (uri.href) {
                        uri = uri.href;
                    }
                    if (!options) options = {};
                    const { params } = localContext.utils.url.paramsParse(uri);
                    options.params = params;
                    if (typeof uri === 'string') uri = localContext.fetch.request.trigger(this, uri, options, 'fetch');
                    if (!(typeof uri === 'string' ? uri : uri.url)) return new Promise((resolve, reject) => reject('fetch error'));
                    if (!uri) {
                        localContext.info('fetch', uri, options, location.href);
                    }
                    req = origin_fetch(uri, options).then(fetch_request);
                } catch (error) {
                    localContext.error('fetch error', error);
                }
                return req;
            };
            return fetch_;
        }();

        this.utils.origin.hook('fetch', fake_fetch);
    }

    initRequest() {
        const localContext = this;
        const fakeRequest = class extends unsafeWindow.Request {
            constructor(input, options = {}) {
                if (typeof input === 'string') {
                    try {
                        input = localContext.fetch.request.trigger(null, input, options, 'request');
                    } catch (error) {
                        localContext.error('Request error', error);
                    }
                }
                super(input, options);
                this.url_ = input;
                if (options && 'body' in options) this['body_'] = options['body'];
            }
        };
        this.utils.origin.hook('Request', fakeRequest);
    }

    initRequest2() {
        const OriginalRequest = unsafeWindow.Request;
        const localContext = this;
        unsafeWindow.Request = new Proxy(OriginalRequest, {
            construct(target, args) {
                let [input, options = {}] = args;
                if (options.signal && !(options.signal instanceof unsafeWindow.AbortSignal)) {
                    delete options.signal;
                }
                input = localContext.fetch.request.trigger(null, input, options, 'request');
                return new target(input, options);
            }
        });
    }

    initXHR() {
        const localContext = this;
        this.xhr = {
            response: {
                text: this.factory('xhrResponseText', { modify: 0 }, { stopPropagation: true, modify: 0 }),
                json: this.factory('xhrResponseJson', {}, { stopPropagation: true })
            },
            request: {
                open: this.factory('xhrRequestOpen', { modify: [0] }, { stopPropagation: true, modify: [0] }),
                send: this.factory('xhrRequestSend', { modify: [0, 1] }, { stopPropagation: true, modify: [0, 1] })
            }
        };

        class fakeXMLHttpRequest extends unsafeWindow.XMLHttpRequest {
            open(method, url, ...opts) {
                url = localContext.xhr.request.open.trigger(this, url, opts);
                if (url === '') url = 'http://192.168.0.1:8080/';
                this.url_ = url;
                return super.open(method, url, ...opts);
            }

            send(body) {
                let url;
                [body, url] = localContext.xhr.request.send.trigger(this, body, this.url_);
                if (url === '') {
                    const hook_get = (name, value) => {
                        localContext.utils.defineProperty(this, name, {
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
                    if (xhr.responseProcess) return xhr.responseProcess;
                    let result = super.response;
                    const url = xhr.responseURL;
                    const result_type = typeof result;
                    if (result_type === 'string') {
                        const options = { body: this.body_, xhr: this };
                        try {
                            if (localContext.xhr.response.json.matchCallbackNum(this, null, url, options)) {
                                try {
                                    const json = JSON.parse(result);
                                    localContext.xhr.response.json.trigger(this, json, url, options);
                                    result = JSON.stringify(json);
                                } catch (error) {
                                    localContext.error(error);
                                }
                            } else {
                                result = localContext.xhr.response.text.trigger(this, result, url, options);
                            }
                        } catch (error) {
                            localContext.error(error);
                        }
                    }
                    xhr.responseProcess = result;
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
        }

        this.utils.origin.hook('XMLHttpRequest', fakeXMLHttpRequest);
    }

    initWebSocket() {
        const localContext = this;
        this.webSocket = {
            onmessage: this.factory('WebSocketOnMessage', {}, { stopPropagation: true }),
            open: this.factory('WebSocketOpen', { modify: [0] }, { modify: [0], stopPropagation: true }),
            send: this.factory('WebSocketSend', { modify: [0] }, { modify: [0], stopPropagation: true })
        };

        const fakeWebSocket = class extends unsafeWindow.WebSocket {
            constructor(url, ...opts) {
                url = localContext.webSocket.open.trigger(null, url, opts);
                super(url, ...opts);

                this.addEventListener('message', (event) => {
                    const res = localContext.webSocket.onmessage.trigger(this, event, url);
                    if (res !== false) return;
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                }, { capture: true, priority: true });

                const originEventListener = this.addEventListener;
                this.addEventListener = function (type, listener, options) {
                    if (type === 'message') {
                        if (options) {
                            options.capture = false;
                            options.priority = false;
                        }
                    }
                    originEventListener.call(this, type, listener, options);
                };

                const originSend = this.send;
                this.send = function (data) {
                    data = localContext.webSocket.send.trigger(this, data, url);
                    if (data === null) return;
                    return originSend.call(this, data);
                };
            }
        };

        this.utils.origin.hook('WebSocket', fakeWebSocket);
    }

    initDyncFileLoad() {
        const localContext = this;
        const dyncLoadFlags = ['iframe', 'img', 'script', 'link', 'video', 'audio', 'source', 'object'];
        this.dyncFileLoad = this.factory('dyncFileLoad', { modify: 0 }, { stopPropagation: true, modify: 0 });

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

        const hookSrc = (node) => {
            const property = setterMap[node.tagName.toLowerCase()].prop;
            this.utils.defineProperty(node, property, {
                get: function () {
                    return this.src_;
                },
                set: function (value) {
                    let url = value;
                    const funSet = localContext.dyncFileLoad.matchCallback(this, value, node);
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

            const originSet = node.setAttribute;
            node.setAttribute = function (name, value) {
                if (name === property) {
                    node[property] = value;
                    return;
                }
                originSet.call(this, name, value);
            };

            node.addEventListener('load', function (event) {
                const funSet = localContext.dyncFileLoad.matchCallback(this, node.src, node);
                for (const [_, options] of funSet) {
                    if (options.tag === node.tagName.toLowerCase() && options.onload) {
                        const res = options.onload.call(event, node);
                        if (res !== false) return;
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                    }
                }
            }, {
                capture: true,
                priority: true,
                once: true
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

        this.core.dom.createElement.subscribe((node) => {
            const funSet = this.dyncFileLoad.manualTrigger(node);
            for (const [_, options] of funSet) {
                if (options.tag === node.tagName.toLowerCase()) {
                    hookSrc(node);
                    return;
                }
            }
        }, { condition: (_, tag) => dyncLoadFlags.includes(tag) });
    }

    initWorker() {
        const localContext = this;
        this.worker = {
            create: this.factory('workerCreate', { modify: [0] }, { stopPropagation: true, modify: [0] }),
            onMessage: this.factory('workerOnMessage', {}, { stopPropagation: true }),
            postMessage: this.factory('workerPostMessage', { modify: [0] }, { stopPropagation: true, modify: [0] }),
        };

        const fakeWorker = class extends unsafeWindow.Worker {
            constructor(scriptURL, options = {}) {
                // 处理脚本URL
                scriptURL = localContext.worker.create.trigger(null, scriptURL, options);
                super(scriptURL, options);

                // 处理消息
                this.addEventListener('message', function (event) {
                    localContext.worker.onMessage.trigger(this, event);
                }, {
                    capture: true,
                    priority: true,
                });
                const origin_addEventListener = this.addEventListener;
                this.addEventListener = function (type, listener, options) {
                    if (type === 'message' && options) {
                        options.capture = false;
                        options.priority = false;
                    }
                    origin_addEventListener.call(this, type, listener, options);
                };

                // 原始postMessage方法
                const originPostMessage = this.postMessage;
                this.postMessage = function (message, transfer) {
                    message = localContext.worker.postMessage.trigger(this, message, transfer);
                    if (!message) return;
                    return originPostMessage.call(this, message, transfer);
                };
            }
        };

        this.utils.origin.hook('Worker', fakeWorker);
    }
}

/**
 * 动画模块
 * 处理动画效果
 */
class AnimateModule extends BaseModule {
    constructor(core) {
        super(core);
    }

    flash(decNode, options = {}) {
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
                    decNode.style[decProName] = this.utils.randomColor();
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
    }

    frontColor(decNode, options = {}) {
        const {
            color = 'yellow',
            isFront = false,
            timeout = 0
        } = options;

        let decProName = isFront ? 'color' : 'backgroundColor';
        let originColor = decNode.style[decProName];
        decNode.style[decProName] = color;

        if (timeout > 0) {
            setTimeout(() => {
                decNode.style[decProName] = originColor;
            }, timeout);
        }

        return () => {
            decNode.style[decProName] = originColor;
        };
    }

    scanLine(decNode, color = 'yellow') {
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

/**
 * 数据处理模块
 */
class DataModule extends BaseModule {
    constructor(core) {
        super(core);

        if (this.isEnabled('json')) {
            this.initJson();
        }

        if (this.isEnabled('localStorage')) {
            this.initLocalStorage();
        }

        if (this.isEnabled('sessionStorage')) {
            this.initSessionStorage();
        }

        this.initDataProcess();
    }

    initJson() {
        this.json = {
            parase: this.factory('jsonParase', { modify: 0 }, { stopPropagation: true, modify: 0 }),
            stringify: this.factory('jsonStringify', {}, { stopPropagation: true })
        };

        const originParse = unsafeWindow.JSON.parse;
        const originStringify = unsafeWindow.JSON.stringify;

        const fakeParse = (text) => {
            const res = this.json.parase.trigger(null, text);
            if (res) text = res;
            return originParse(text);
        };

        const fakeStringify = (obj) => {
            this.json.stringify.trigger(null, obj);
            return originStringify(obj);
        };

        this.utils.origin.hook('JSON.parse', fakeParse);
        this.utils.origin.hook('JSON.stringify', fakeStringify);
    }

    initLocalStorage() {
        const localContext = this;
        this.localStorage = {
            setItem: this.factory('localStorageSetItem', { modify: 0 }, { stopPropagation: true, modify: 0 }),
            getItem: this.factory('localStorageGetItem', { modify: 0 }, { stopPropagation: true, modify: 0 })
        };

        const originSetItem = unsafeWindow.localStorage.setItem;
        const originGetItem = unsafeWindow.localStorage.getItem;

        const fakeSetItem = function (key, value) {
            value = localContext.localStorage.setItem.trigger(this, value, key);
            if (!value) return;
            return originSetItem.call(this, key, value);
        };
        this.utils.origin.hook('localStorage.setItem', fakeSetItem);

        const fakeGetItem = function (key) {
            let value = originGetItem.call(this, key);
            value = localContext.localStorage.getItem.trigger(this, value, key);
            return value;
        };
        this.utils.origin.hook('localStorage.getItem', fakeGetItem);
    }

    initSessionStorage() {
        const localContext = this;

        this.sessionStorage = {
            setItem: this.factory('sessionStorageSetItem', { modify: 0 }, { stopPropagation: true, modify: 0 }),
            getItem: this.factory('sessionStorageGetItem', { modify: 0 }, { stopPropagation: true, modify: 0 })
        };

        const originSetItem = unsafeWindow.sessionStorage.setItem;
        const originGetItem = unsafeWindow.sessionStorage.getItem;

        const fakeSetItem = function (key, value) {
            value = localContext.sessionStorage.setItem.trigger(this, value, key);
            if (!value) return;
            return originSetItem.call(this, key, value);
        };
        this.utils.origin.hook('sessionStorage.setItem', fakeSetItem);

        const fakeGetItem = function (key) {
            let value = originGetItem.call(this, key);
            value = localContext.sessionStorage.getItem.trigger(this, value, key);
            return value;
        };
        this.utils.origin.hook('sessionStorage.getItem', fakeGetItem);
    }

    initDataProcess() {
        const localContext = this;
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
                        localContext.error(error);
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
                            this.error('text_process JSON parse error', error);
                            return data;
                        }
                        this.obj_process(json_data, values, { traverse_all: traverse_all });
                        data = JSON.stringify(json_data);
                    }
                } catch (error) {
                    localContext.error('text_process error', error);
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
                    return eval(localContext.utils.security.trustedScript(method_match[1]));
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
                return eval(localContext.utils.security.trustedScript(path.replace('json_obj', 'obj')));
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
                    localContext.error(error);
                }
                return;
            }

            obj_process(json_obj, express_list, { traverse_all = false, get_value = false, get_path = false, deep_traverse = false } = {}) {

                if (typeof json_obj !== 'object') {
                    localContext.error('obj_process不是对象', express_list);
                    return;
                }
                const express_list_type = typeof express_list;
                if (express_list_type === 'function') {
                    try {
                        express_list = express_list(json_obj);
                        if (!express_list || Array.isArray(express_list) && express_list.length === 0) return;
                    } catch (error) {
                        localContext.error('obj_process express_list函数执行错误', error);
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
                                    localContext.error('obj_path_match error ', path);
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
                    localContext.error('obj_process处理失败', error);
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
                            localContext.error('obj_process获取数组长度失败--->' + path, error);
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
                            return localContext.error('obj_process数组索引格式错误--->' + path);
                        }
                    } else if (array_index.includes('-')) {
                        const index_arr = array_index.split('-');
                        if (index_arr.length !== 2) return localContext.error('obj_process数组索引格式错误--->' + path);
                        const start = Number(index_arr[0]);
                        const end = Number(index_arr[1]);
                        if (isNaN(start) || isNaN(end)) {
                            return localContext.error('obj_process数组索引格式错误--->' + path);
                        }
                        array_index_list = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                    } else if (!isNaN(array_index)) {
                        array_index_list = [array_index];
                    } else {
                        return localContext.error('obj_process数组索引格式错误--->' + path);
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
                            return localContext.error('obj_modify处理失败，找不到对象--->' + path_info);
                        }
                    }
                    if (operator === '=-') {
                        const is_array = typeof last_key === 'number';
                        if (is_array)
                            last_obj.splice(last_key, 1);
                        else
                            delete last_obj[last_key];
                        localContext.info('依据：' + path_info.express, 'obj_process');
                        localContext.info('删除属性-->' + path, 'obj_process');
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
                        localContext.info('依据：' + path_info.express, 'obj_process');
                        localContext.info('修改属性-->' + path, 'obj_process');
                        return;
                    }
                    const dec_obj = last_obj[last_key];
                    if (!dec_obj) {
                        return localContext.error('obj_modify处理失败，找不到对象--->' + path_info);
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
                                    localContext.error(error);
                                }
                            } else {
                                last_obj[last_key].push(value);
                            }
                        }
                        if (type_ === 'string' || type_ === 'number') last_obj[last_key] = last_obj[last_key] + value;
                        localContext.info('依据：' + path_info.express, 'obj_process');
                        localContext.info('修改属性-->' + path, 'obj_process');
                    }
                    if (operator === '~=') {
                        const search_value = value.split(SPLIT_TAG)[0];
                        const replace_value = value.split(SPLIT_TAG)[1];
                        last_obj[last_key] = dec_obj.replace(new RegExp(search_value, 'g'), replace_value);
                        localContext.info('依据：' + path_info.express, 'obj_process');
                        localContext.info('修改属性-->' + path, 'obj_process');
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
                            localContext.info('条件成立-->', condition, typeof condition_value === 'object' ? '[object Object]' : condition_value, 'obj_process');
                            break;
                        }
                    }
                    if (!result) return false;
                }
                return true;
            }
        }
        this.dataProcess = new DATA_PROCESS();
    }
}

// 其他api集合模块
class OtherModule extends BaseModule {
    constructor(core) {
        super(core);

        if (this.isEnabled('promise')) {
            this.initPromise();
        }

        if (this.isEnabled('canvas')) {
            this.initCanvas();
        }

        if (this.isEnabled('random')) {
            this.initRandom();
        }

        if (this.isEnabled('webpack')) {
            if (this.config.webpack) {
                this.initWebpack();
            } else {
                this.error('webpack拦截需要传入一个webpack具体名称');
            }
        }
    }

    initPromise() {
        const localContext = this;
        this.promise = this.factory('Promise', { modify: [0, 1] }, { stopPropagation: true, modify: [0, 1] });
        const fakePromise = class extends unsafeWindow.Promise {
            then(onFulfilled, onRejected) {
                [onFulfilled, onRejected] = localContext.promise.trigger(this, onFulfilled, onRejected);
                return super.then(onFulfilled, onRejected);
            }
        };
        this.utils.origin.hook('Promise', fakePromise);
    }

    initCanvas() {
        const localContext = this;
        let origin_toDataURL = unsafeWindow.HTMLCanvasElement.prototype.toDataURL;
        const fakeToDataURL = function (type, encoderOptions) {
            const value = origin_toDataURL.apply(this, arguments);
            const result = localContext.canvas.trigger(this, type, encoderOptions);
            return result || value;
        };
        this.utils.origin.hook('HTMLCanvasElement.prototype.toDataURL', fakeToDataURL);
    }

    initRandom() {
        const localContext = this;
        this.random = this.factory('random', {}, { stopPropagation: true });
        const originRandom = Math.random;
        const fakeRandom = function () {
            const result = localContext.random.trigger(this);
            return result || originRandom.apply(this);
        };
        this.utils.origin.hook('Math.random', fakeRandom);
    }

    /**
     * 
     * 
     * @example
     * 
     * 初始化
     * options = {'webpack': 'webpackJsonp' , enable:['webpack'] }  
     * 使用
     * this.webpack.subscribe((moduleId, moduleContent) => {
     *   console.log('加载模块:', moduleId);
     * });
     */
    initWebpack() {
        this.webpack = this.factory('webpack', {}, {});
        let webpack = null;
        const localContext = this;
        const hookPush = () => {
            const originPush = webpack.push;
            webpack.push = function (chunk) {
                localContext.webpack.trigger(null, ...chunk);
                originPush.call(this, chunk);
            };
        };
        this.utils.defineProperty(unsafeWindow, this.config.webpack, {
            get: function () {
                return webpack;
            },
            set: function (value) {
                webpack = value;
                if (typeof webpack === 'object') hookPush();
            }
        });
    }

}

if (unsafeWindow.inject_xxxx) return;
unsafeWindow.inject_xxxx = true;