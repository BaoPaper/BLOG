---
title: OpenWRT USB 开关控制
description: 基于 uhubctl 的 OpenWRT USB 开关控制
pubDate: 2024-11-05
tags: [Linux]
---

基于 [uhubctl](https://github.com/mvp/uhubctl) 的 USB 开关控制，在软路由上实现了基于 adb 电量获取的外接手机自适应充电

```bash
# 关闭
uhubctl -a off -p 1
# 开启
uhubctl -a on -p 1
```
