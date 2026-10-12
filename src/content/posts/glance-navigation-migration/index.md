---
title: 记一次个人导航页迁移
description: 将个人导航页从 Flare 迁移至功能更丰富、内存占用更低的个人信息仪表盘 Glance。
pubDate: 2025-03-22 15:11:52
tags: [记录]
---

因为觉得功能简陋的原因将导航页系统从 [Flare](https://github.com/soulteary/docker-flare) 更换到了 [Glance](https://github.com/glanceapp/glance)。

Flare 的功能很纯粹，就是简单的书签导航，Glance 则更接近个人信息仪表盘吧，使用组件的概念编辑页面，十分灵活，内置的组件也很丰富，如下图的官方示例图片，日历、RSS、频道订阅、新闻、天气、股票等等。

![官方示例图片](./readme-main-image.webp)

经过配置后我的页面长这样

![我的页面](./my-dashboard.webp)

我使用 RSS 订阅在页面左侧展示 LINUX DO 论坛的最新帖子，还通过自定义 API 组件在右侧展示了一个学习通作业看板。

Glance 在屏幕尺寸适配上很用心，下面图片是在手机上使用时的界面，在上一张图片中的左中右三个分栏在手机上个成为了独立的页面，通过页面底部的小按钮进行切换，按钮切换动画十分流畅，用着很舒服。

![手机界面](./mobile-view.avif)

最后，神奇的是，Glance 对比 Flare 的内存占用反而更低。Flare 大概占用 30MB，而 Glance 只占用 10MB 左右。
