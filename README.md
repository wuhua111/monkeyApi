# QuicklyModel API v1.0.4

一个强大的油猴脚本 API 框架，提供了丰富的功能模块和工具集，用于简化和增强浏览器端的脚本开发。

## 特性

### 核心功能

- 模块化设计，支持按需启用/禁用功能
- 完整的事件处理系统
- 网络请求拦截和修改
- DOM 操作和监控
- 数据处理和存储
- 动画效果支持
- 安全策略管理
- 日志系统
- 自动化资源管理（订阅自动解除，实例自动销毁）

### 主要模块

#### 1. 工具模块 (UtilsModule)

- API 工厂：用于创建和管理 API 实例
- 日志系统：支持多级别日志记录和存储
- 安全工具：提供安全策略和可信脚本处理
- 类型检查：提供类型判断工具
- Cookie 管理：Cookie 的读写和删除
- URL 处理：URL 参数解析和合并
- 调试工具：对象分析和调试辅助
- 原生函数钩子：支持原生函数的劫持和修改

#### 2. DOM 模块 (DOMModule)

- DOM 查询：简化的选择器 API
- 元素创建监控：监控 DOM 元素的创建
- iframe 处理：iframe 相关功能增强
- 元素等待：等待特定元素出现或渲染完成
- 元素属性监控：监控元素属性变化

#### 3. 事件模块 (EventModule)

- DOM 内容加载监听
- URL 变化监听
- 事件监听器管理
- 消息通信增强
- 窗口打开监控
- 双击事件处理
- eval 执行监控
- 事件传播控制

#### 4. 网络模块 (NetworkModule)

- Fetch 请求拦截
- XMLHttpRequest 拦截
- WebSocket 拦截
- 动态文件加载监控
- Worker 通信增强
- 请求参数修改
- 响应内容处理
- 请求重定向

#### 5. 动画模块 (AnimateModule)

- 闪烁效果：支持前景和背景闪烁
- 前景色变化：颜色渐变效果
- 扫描线效果：动态扫描线动画
- 自定义动画控制
- 动画时间控制

#### 6. 数据模块 (DataModule)

- JSON 处理：解析和序列化拦截
- LocalStorage 管理：本地存储操作
- SessionStorage 管理：会话存储操作
- 数据处理工具：复杂数据处理
- 对象遍历和修改
- 路径解析和处理
- 条件过滤和匹配

#### 7. 日期时间模块 (DateModule)

- Date 对象拦截
- setTimeout 监控
- setInterval 监控
- 时间操作增强

## 安装

1. 在油猴脚本中引入框架：

```javascript
// @require https://path/to/quicklymodel.module.1.0.4.js
```

2. 初始化 API：

```javascript
const api = new QuicklyModelCore({
  dev: false, // 开发模式
  enable: ["fetch", "xhr"], // 启用的功能
  disable: ["webSocket"], // 禁用的功能
});
```

## 使用示例

### 1. 网络请求拦截

```javascript
// 拦截 fetch 请求
api.net.fetch.request.subscribe((url, options) => {
  console.log("拦截到请求:", url);
  return url; // 返回修改后的 URL
});

// 拦截 XHR 响应
api.net.xhr.response.text.subscribe((text, url) => {
  console.log("拦截到响应:", url);
  return text; // 返回修改后的响应内容
});
```

### 2. DOM 监控

```javascript
// 监控元素创建
api.dom.createElement.subscribe((node, tag) => {
  if (tag === "iframe") {
    console.log("创建了新的 iframe");
  }
});

// 等待元素出现
api.dom
  .waitElement(
    document.body,
    (node) => node.classList.contains("target-class"),
    { timeout: 5000 }
  )
  .then((element) => {
    console.log("目标元素已出现:", element);
  });
```

### 3. 事件处理

```javascript
// URL 变化监听
const unsubscribe = api.event.urlChange.subscribe((href, oldHref) => {
  console.log("URL 变化:", oldHref, "->", href);
});

// 可以通过调用返回的函数来解除订阅
unsubscribe();

// 双击处理
const node = document.querySelector("#myElement");
const dbClickHandler = api.event.dbClickAPI(node, (e) => {
  console.log("触发双击事件");
});

// 启动监听
dbClickHandler.start();

// 在不需要时关闭监听
dbClickHandler.close();
```

### 4. 数据处理

```javascript
// JSON 处理
const unsubscribeJson = api.data.json.stringify.subscribe((obj) => {
  console.log("JSON 序列化:", obj);
});

// LocalStorage 监控
const unsubscribeStorage = api.data.localStorage.setItem.subscribe(
  (value, key) => {
    console.log("LocalStorage 设置:", key, value);
    return value;
  }
);

// 数据处理工具
const dataProcess = api.data.dataProcess;
dataProcess.obj_get_values(
  jsonData,
  [
    "a=1",
    "b=num(1)",
    "c=json(true)",
  ],
  { traverse_all: true }
);

// 解除订阅
unsubscribeJson();
unsubscribeStorage();
```

### 5. 动画效果

```javascript
// 闪烁效果
const flashAnimation = api.animate.flash(element, {
  frequency: 100,
  isFront: false,
  timeout: 3000,
});

// 启动动画
flashAnimation.start();

// 停止动画
flashAnimation.close();

// 扫描线效果
const scanAnimation = api.animate.scanLine(element, "#ff0000");
scanAnimation.start();
scanAnimation.close();
```

### 6. 时间控制

```javascript
// setTimeout 监控
api.date.setTimeout.subscribe((fn, delay) => {
  console.log("设置延时:", delay);
  return [fn, delay];
});

// Date 拦截
api.date.date.subscribe((type, args) => {
  console.log("Date 操作:", type);
});
```

## 配置选项

### 默认启用的功能

- createElement: 拦截 DOM 元素
- iframe: iframe 相关功能
- fetch: fetch 请求拦截
- xhr: XMLHttpRequest 拦截
- request: Request 拦截

### 默认关闭的功能

- webSocket: WebSocket 拦截
- worker: Worker 拦截
- dyncFileLoad: 动态文件加载拦截
- json: JSON 数据处理
- sessionStorage: SessionStorage 操作
- localStorage: LocalStorage 操作
- message: 消息通信
- open: 打开新窗口
- addEventListener: 事件监听
- setTimeout: setTimeout 拦截
- setInterval: setInterval 拦截
- eval: eval 拦截
- date: Date 拦截
- promise: Promise 拦截
- canvas: Canvas 拦截
- random: Math.random 拦截

## 注意事项

1. 开发模式

   - 设置 `dev: true` 开启开发模式
   - 开发模式下会在控制台输出详细日志
   - 提供调试工具 `unsafeWindow.debug_`

2. 性能考虑

   - 按需启用功能，避免不必要的功能开启
   - 合理使用事件监听器，及时移 ��� 不需要的监听
   - 避免过度使用深度遍历和复杂数据处理
   - 记得调用 unsubscribe 或 close 方法释放资源
   - 使用完毕的功能及时关闭以避免内存泄漏

3. 安全性

   - 提供可信脚本处理机制
   - 支持安全策略设置
   - 建议谨慎处理敏感数据
   - 注意 eval 和动态脚本的使用

4. 兼容性

   - 支持主流浏览器
   - 部分功能可能需要特定的浏览器版本
   - 注意检查功能的可用性

5. 资源管理
   - 所有订阅操作都会返回 unsubscribe 方法
   - 所有 start 操作都有对应的 close 方法
   - 建议使用 try-finally 确保资源正确释放
   - 可以通过变量跟踪订阅状态
   - 模块销毁时会自动清理所有订阅

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request
