---
title: 使 Git Bash 发出提示音而非闪屏
description: 修改 Readline 配置文件控制 Git Bash 行为
pubDate: 2026-04-18
tags: [Linux]
---

```bash
echo "set bell-style audible" >> ~/.inputrc
```

`bell-style` 控制当 Readline 想要响起终端铃声时会发生什么。如果设置为`none`，Readline 则从不响铃。如果设置为 `visible`，Readline 会使用可见的铃声（如果有）。如果设置为`audible`（默认），Readline 会尝试响起终端的铃声。

> https://web.mit.edu/gnu/doc/html/features_7.html
