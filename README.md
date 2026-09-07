# dsh-composer-recall

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

English | [简体中文](README.zh-CN.md)

Arrow-key input history for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web composer on **0.1.2-alpha.1**.

Press **↑** in an empty composer (or with the caret at the start) to recall the current session's user prompts. **↓** walks forward. **Esc** restores the draft you were typing.

This is written against the Lexical composer (`div[data-composer-input]`) and the official `conversation.input` `setDraft()` seam. Older plugins that still read `session.getSnapshot().nodes` or a `<textarea>` do not work on this host.

## Install

```sh
dsh plugin --profile desktop add dsh-composer-recall
```

or from GitHub:

```sh
dsh plugin --profile desktop add github:WongYuYe/pokemon-claw
```

Restart DSH Desktop (or refresh the web GUI) after installing.

From source:

```sh
git clone https://github.com/WongYuYe/pokemon-claw.git
cd pokemon-claw
dsh plugin --profile desktop add .
```

## Use

1. Focus the composer.
2. With an empty draft, or with the caret at the start of the draft, press **↑**.
3. Press **↑** again for older prompts, **↓** to move forward.
4. Press **Esc** to leave history and restore the stashed draft.
5. Typing while browsing keeps the recalled text and leaves history mode.

History is the user messages currently rendered in the open session. It is not a global ring across workspaces.

## Compatibility

| Surface | Status |
|---|---|
| Harness | DeepSeek Harness `0.1.2-alpha.1` (Lexical composer) |
| Platforms | Web GUI / DSH Desktop |
| Persistence | Current session only (rendered user rows) |

## Why this exists

On 0.1.2-alpha.1 the session snapshot no longer exposes `nodes`, and the composer is a Lexical contenteditable rather than a textarea. Community history plugins targeting the rc line crash or silently no-op. This plugin reads `[data-chat-flow-kind="user"]` rows and writes through `shell.setDraft(text)`.

## License

MIT
