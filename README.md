# Easy Draw.io - Sidebar Diagram Editor

这款 Chrome/Edge 浏览器扩展将强大的 [Draw.io (diagrams.net)](https://app.diagrams.net/) 无缝嵌入到了浏览器的侧边栏 (Side Panel) 中。它的核心设计理念是让您能够“一边浏览网页（如阅读文档、使用 ChatGPT 等 AI 工具），一边随手画图”。

## ✨ 核心特性

1. **原生的侧边栏体验**
   - 采用 Manifest V3 标准的 Side Panel API，UI 与浏览器完美融合。
   - 专为窄屏优化的精简暗色系界面 (`ui=min` 模式)，支持无极拖拽宽度。

2. **多标签页数据隔离 (Tab-Specific Isolation)**
   - **绝不串场**：侧边栏严格绑定在当前标签页 (`tabId`)。在标签A画图不仅不会影响标签B的侧边栏，两者还可以独立保存各自的草稿！
   - 点击浏览器右上角插件图标可随时在当前标签页打开/关闭侧边栏。
   - 关闭标签页时，自动触发垃圾回收机制清理残留草稿。

3. **实时自动缓存**
   - 所有的图形 XML 数据均通过 `chrome.storage.local` 保存在您的本地浏览器中。
   - 告别突然断网或误触刷新的烦恼（底部状态栏随时提示 Save 状态）。

4. **一键导出功能**
   - 支持将当前画布直接导出为 `PNG`、`SVG` 以及原生的 `Draw.io XML` 格式，并通过浏览器原生下载行为无缝保存。

5. **代码一键转图表 (Code-to-Diagram)**
   - 深度整合 AI 绘图流：复制 AI 生成的代码即可在右侧边栏直接转换为可视化图表进行二次修改。
   - 支持直接导入 **原生 Draw.io XML** 代码。
   - 支持导入 **Mermaid** 或 **PlantUML** 格式的文本语言。

## 🛡️ 隐私与开源声明

**本插件 100% 保护您的隐私数据，并可作为开源项目分发。**

- **零隐私追踪**：插件不仅没有引入任何如 Google Analytics 的第三方追踪器，同时您的所有草稿和导出的图表数据均**只物理存储于您的本地浏览器 (`chrome.storage.local`) 中**。没有任何数据会被上传至不属于您的第三方服务器。
- **合规合法的核心调用**：本插件未使用非法的爬虫抓取技术或盗用源码，而是**合法合规地嵌入了 JGraph 团队（Draw.io 官方）为开发者提供的正式 API (`https://embed.diagrams.net/`)**。此举既保证了插件本身的极度轻量（无需打包 50MB+ 的官方源码），又能始终与官方版本的功能保持实时同步。
- **开源友好**：本项目代码均为独立手写实现（包含所有 API 拦截、存储隔离、UI 层构建），您可以放心地通过 MIT 或 Apache 2.0 协议在 GitHub 等平台上开源。

## 🚀 安装步骤 (开发者模式)

1. 打开您的基于 Chromium 的浏览器 (Google Chrome 或 Microsoft Edge)。
2. 在地址栏输入 `chrome://extensions/`（Chrome）或 `edge://extensions/`（Edge），进入扩展管理页面。
3. 打开页面右上角或左下角的 **开发者模式 (Developer mode)** 开关。
4. 点击左上角的 **加载已解压的扩展程序 (Load unpacked)**。
5. 在弹出的本地文件选择器中，选中本项目的根文件夹（即包含 `manifest.json` 的目录）。
6. 加载成功后，强烈建议您点击浏览器工具栏的“拼图”图标，将 **Easy Draw.io** 固定 (Pin) 在工具栏。

## 💡 使用指南

- **打开画板**：在任何需要作图的网页上，点击本插件的图标，即可召唤右侧边栏。 
- **手动保存**：虽然插件会自动保存，但您也可以随时使用快捷键 `Ctrl + S` （或 `Cmd + S`）手动保存，或者点击顶部工具栏的保存按钮。
- **重新开始**：点击顶部工具栏的第一个按钮 (New Diagram) 可以清空当前标签页的草稿，重新创建一张空图。
- **导入代码**：点击顶部工具栏最右侧带有 `</>` 的按钮打开导入面板，在下拉菜单选择您的代码类型 (`Draw.io XML`, `Mermaid`, `PlantUML`)，粘贴代码并点击 Insert 即可直接渲染！

## 🛠️ 技术栈说明

- **Manifest V3**
- Vanilla JavaScript / CSS / HTML 纯净组合构建
- `window.postMessage` Draw.io 官方 Embed Protocol 通信协议
- 极速启动：Iframe 调用官方的极简 UI 嵌入前端 (`ui=min` 与 JSON 协议)
