---
title: 更改 Fedora SSH 端口
description: Fedora 改 SSH 端口需先配置 SELinux
pubDate: 2024-11-21
tags: [Linux]
---

由于 Fedora Workstation 默认启用 SELinux 管理端口，所以想要修改 SSH 端口需要进行一些额外配置。

将新端口添加到 SELinux 的 SSH 端口类型中，例如端口 2233

```bash
sudo semanage port -a -t ssh_port_t -p tcp 2233
```

修改 SELinux 配置后，再重启 sshd 服务应该就好了。
