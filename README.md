# dsh-composer-recall

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

简体中文 | [English](README.en.md)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) **0.1.2-alpha.1** 输入框用的方向键历史。

空输入框（或光标在草稿开头）按 **↑** 召回当前会话里刚发过的话，**↓** 前进，**Esc** 还原正在打的草稿。

适配 Lexical 输入框（`div[data-composer-input]`）和官方 `setDraft()`。仍去读 `session.getSnapshot().nodes` 或 `<textarea>` 的旧历史插件，在这个版本上会崩或没反应。

## 安装

```sh
dsh plugin --profile desktop add dsh-composer-recall
```

或从 GitHub：

```sh
dsh plugin --profile desktop add github:WongYuYe/dsh-composer-recall
```

装完请重启 DSH Desktop（或刷新 Web GUI）。

从源码：

```sh
git clone https://github.com/WongYuYe/dsh-composer-recall.git
cd dsh-composer-recall
dsh plugin --profile desktop add .
```

## 使用

1. 聚焦输入框。
2. 草稿为空，或光标在草稿开头时，按 **↑**。
3. 再按 **↑** 看更早的消息，**↓** 前进。
4. 按 **Esc** 退出历史并还原暂存的草稿。
5. 浏览时直接打字会保留召回内容并离开历史模式。

历史来自当前会话已经渲染出来的用户消息，不是跨工作区的全局环。

## 兼容性

| 面 | 状态 |
|---|---|
| Harness | DeepSeek Harness `0.1.2-alpha.1`（Lexical 作曲器） |
| 平台 | Web GUI / DSH Desktop |
| 持久化 | 仅当前会话（已渲染的用户行） |

## 为什么要做这个

0.1.2-alpha.1 的会话快照不再暴露 `nodes`，作曲器也从 textarea 换成了 Lexical contenteditable。面向 rc 线的社区历史插件会崩或静默失效。本插件从 `[data-chat-flow-kind="user"]` 行读取，并通过 `shell.setDraft(text)` 写回。

## 许可

MIT
