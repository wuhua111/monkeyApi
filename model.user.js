// ==UserScript==
// @name         name
// @namespace    http://tampermonkey.net/
// @version      0.3
// @author       author
// @match        *
// @connect      cdn.jsdelivr.net
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_addElement
// @grant        GM_setValue
// @grant        GM_getValue
// @require      file:///G:/vscode/chrome_extend/monkeyApi/quicklymodel.module.1.0.4.js?12320
// @noframes
// @run-at       document-start
// @license      MIT
// ==/UserScript==

// @require      https://gcore.jsdelivr.net/gh/wuhua111/monkeyApi@main/quicklymodel.module.1.0.3.js


const api = new QuicklyModelCore({
    dev: true,
    // disable: [],
    // enable: ['json', 'dyncFileLoad', 'webSocket', 'message', 'addEventListener']
});
const logger = new api.utils.Logger({ moduleName: 'modelTest', showInConsole: true });
const $ = api.dom.query.$;
const $$ = api.dom.query.$$;


(function () {
    main();

    function main() {
        logger.info('Hello World');
    }
})();



