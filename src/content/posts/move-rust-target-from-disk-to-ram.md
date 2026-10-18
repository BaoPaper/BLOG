---
title: 把 Rust 的编译目录从硬盘丢到内存
description: 针对 Rust 编译太费硬盘的一次优化
pubDate: 2026-10-18 15:36:14
tags: [工具]
---

> 注意，以下的配置适用于 Linux，且推荐至少内存 >= 32G 时使用，以及请检查一下 /tmp 是否是 tmpfs 文件系统，这是使用内存放编译目录的前提

Rust 的编译产物 target 文件夹非常庞大，频繁编译项目时总是担心对硬盘的消耗，于是乎就有了下面的配置优化，先安装需要的包。

```bash
# Ubuntu/Debian 使用
sudo apt install sccache
# Fedora 使用
sudo dnf install sccache
```

### ~/.cargo/config.toml

```toml
[build]
rustc-wrapper = "sccache"
```

使用 `sccache` 来将编译产物缓存到硬盘，加速重启电脑后的重新编译。

### ~/.config/fish/functions/cargo.fish

```fish
function cargo --wraps=cargo --description 'Build Rust projects in /tmp with sccache'
    set -l project_root (git rev-parse --show-toplevel 2>/dev/null; or pwd)
    set -l project_name (basename "$project_root")

    set -lx CARGO_TARGET_DIR "/tmp/cargo-target/$project_name"
    set -lx CARGO_INCREMENTAL 0

    command cargo $argv
end
```

这个配置在 Fish Shell 才可用，包装 cargo 命令，识别当前工作目录并自动使用 `/tmp/cargo-target/` 下的子目录作为 Cargo 的 TARGET 目录。

### ~/.local/bin/ra-wrapper

```bash
#!/usr/bin/env bash

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
PROJECT_NAME=$(basename "$PROJECT_ROOT")

export RUSTC_WRAPPER=""
export CARGO_INCREMENTAL="1"
export CARGO_TARGET_DIR="/tmp/ra-target/${PROJECT_NAME}"

exec rust-analyzer "$@"
```

一个 rust-analyzer 的命令包装，识别当前工作目录并自动使用 `/tmp/ra-target/` 下的子目录作为 rust-analyzer 的 TARGET 目录。

这里目录使用与 cargo 不同的目录可以防止两者并发时抢锁。

### ~/.config/helix/languages.toml

```toml
[language-server.rust-analyzer]
command = "ra-wrapper"
```

配置 Helix 编辑器在使用 `rust-analyzer` LSP 服务器时使用自定义的 `ra-wrapper` 作为命令入口。

### 验证是否生效

```bash
cargo build && cargo clean && cargo build
sccache --show-stats | grep -E 'Cache hits|Cache misses'
du -sh /tmp/cargo-target/*
df -h /tmp
```

第二次编译时应命中缓存。

## 大功告成

这样一来就实现了在 Fish Shell 下使用 Cargo 运行编译项目和 `rust-analyzer` 运行时使用 /tmp 内存盘，重启即清空，不消耗硬盘。
