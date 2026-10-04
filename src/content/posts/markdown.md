---
title: "MarkDown"
pubDate: 2025-01-01
description: "各种 MarkDown 语法渲染测试。"
---

# Markdown 语法示例

## 1. 标题
# 一级标题
## 二级标题
### 三级标题

## 2. 文本样式
**粗体**、*斜体*、***粗斜体***、~~删除线~~、`行内代码`

## 3. 段落与换行
这是第一段。

这是第二段。  
这一行通过行尾两个空格实现换行。

## 4. 列表
- 无序列表项
  - 嵌套项
1. 有序列表项
2. 第二项

- [x] 已完成任务
- [ ] 未完成任务

## 5. 链接与图片
[OpenAI](https://www.openai.com)

![必应每日一图](https://uapis.cn/api/v1/image/bing-daily)

![自然风光：高山与湖泊](https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80)

![星空与银河](https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80)

## 6. 引用
> 一级引用
>
> > 嵌套引用

## 7. 代码
行内代码：`npm install`

代码块：

```javascript
function hello(name) {
  console.log(`Hello, ${name}!`);
}
```

```python
def fibonacci(n: int) -> list[int]:
    """生成前 n 个斐波那契数"""
    if n <= 0:
        return []
    fibs = [0, 1]
    while len(fibs) < n:
        fibs.append(fibs[-1] + fibs[-2])
    return fibs[:n]

print(fibonacci(10))
```

```bash
# 安装依赖并启动开发服务
pnpm install
pnpm dev
```

## 8. 表格
| 语法 | 效果 | 示例 |
| --- | --- | --- |
| `**文本**` | 粗体 | **粗体** |
| `*文本*` | 斜体 | *斜体* |

## 9. 分隔线
---

## 10. 脚注与转义
这是一个脚注[^1]。

\*星号会被转义，不会变成斜体\*

[^1]: 这是脚注内容。
