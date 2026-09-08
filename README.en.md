# dsh-composer-recall

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![npm](https://img.shields.io/npm/v/dsh-composer-recall?style=flat-square)](https://www.npmjs.com/package/dsh-composer-recall)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[简体中文](README.md) | English

Arrow-key input history for the [DSH Desktop](https://github.com/anywhere-labs/dsh-desktop) composer: press **↑** in an empty box to recall this session’s prompts, **↓** to go forward, **Esc** to restore the draft you were typing.

Built for the current Lexical composer. Older history plugins that still look for `session.getSnapshot().nodes` or a `<textarea>` crash or do nothing on this host.

## Install

```sh
dsh plugin --profile desktop add dsh-composer-recall
```

or from GitHub:

```sh
dsh plugin --profile desktop add github:WongYuYe/dsh-composer-recall
```

Refresh the web GUI or restart DSH Desktop.

From source:

```sh
git clone https://github.com/WongYuYe/dsh-composer-recall.git
cd dsh-composer-recall
dsh plugin --profile desktop add .
```

Requires DeepSeek Harness `0.1.2-alpha.1` or later (Lexical composer).

## Use

1. Focus the composer.
2. With an empty draft, or with the caret at the start, press **↑**.
3. Press **↑** again for older prompts, **↓** to move forward.
4. Press **Esc** to leave history and restore the stashed draft.
5. Typing while browsing keeps the recalled text and leaves history mode.

History is the user messages currently shown in the open session. It is not a global ring across workspaces.

## License

MIT
