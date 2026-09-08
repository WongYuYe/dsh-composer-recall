# dsh-composer-recall

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![npm](https://img.shields.io/npm/v/dsh-composer-recall?style=flat-square)](https://www.npmjs.com/package/dsh-composer-recall)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

简体中文 | [English](README.en.md)

给 [DSH Desktop](https://github.com/anywhere-labs/dsh-desktop) 输入框用的方向键历史：空着按 **↑** 召回本会话刚发过的话，**↓** 前进，**Esc** 还原正在打的草稿。

适配现在的 Lexical 输入框。去读 `session.getSnapshot().nodes` 或 `<textarea>` 的旧历史插件，在这个版本上会崩或没反应。

## 安装

```sh
dsh plugin --profile desktop add dsh-composer-recall
```

或从 GitHub：

```sh
dsh plugin --profile desktop add github:WongYuYe/dsh-composer-recall
```

装完刷新 Web GUI，或重启 DSH Desktop。

从源码：

```sh
git clone https://github.com/WongYuYe/dsh-composer-recall.git
cd dsh-composer-recall
dsh plugin --profile desktop add .
```

需要 DeepSeek Harness `0.1.2-alpha.1` 及以上（Lexical 输入框）。

## 使用

1. 聚焦输入框。
2. 草稿为空，或光标在开头时，按 **↑**。
3. 再按 **↑** 看更早的消息，**↓** 前进。
4. **Esc** 退出历史，还原暂存的草稿。
5. 浏览时直接打字会留下召回的内容，并退出历史。

历史只来自当前会话已经显示出来的用户消息，不是跨工作区的全局环。

## 发布

把 `package.json` 改成 `X.Y.Z`，推 `vX.Y.Z` tag。GitHub Actions 会打 Release 并用 Trusted Publisher 发到 npm。

## License

MIT
