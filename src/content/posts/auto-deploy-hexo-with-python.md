---
title: 使用Python脚本自动部署Hexo
description: 使用 Python 脚本监听文章目录变更并自动执行 Hexo 清理、生成与部署。
pubDate: 2023-07-03 18:52:57
tags: [教程, Python, 编程]
---

博主在使用Hexo编写博客时发现每次写完新的文章后都需要手动部署博客，十分的不方便，于是请教 ChatGPT 用 Python 写了一个简单的脚本来帮我部署博客，实测运行效果很好，代码如下：

```python
import os
import time
import subprocess

# 监听的文件夹路径
posts_folder = '你的 Hexo 博客文章路径'

# 博客文件夹路径
hexo_folder = '你的 Hexo 博客路径'

# 上次检测到的文件夹状态
last_state = {}

def get_folder_state(folder):
    # 获取文件夹中所有文件的最后修改时间
    state = {}
    for root, dirs, files in os.walk(folder):
        for file in files:
            path = os.path.join(root, file)
            state[path] = os.path.getmtime(path)
    return state

def execute_command(command):
    # 执行命令
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    output, error = process.communicate()
    if process.returncode != 0:
        print(f"执行命令出错：{error.decode('utf-8')}")
    else:
        print(f"执行命令成功：{output.decode('utf-8')}")

while True:
    current_state = get_folder_state(posts_folder)
    
    # 检查是否有文件夹变更
    if current_state != last_state:
        print("检测到文件夹变更，执行命令...")
        
        # 执行hexo clean命令
        clean_command = "cd {} && hexo clean".format(hexo_folder)
        execute_command(clean_command)
        
        # 执行hexo g命令
        generate_command = "cd {} && hexo g".format(hexo_folder)
        execute_command(generate_command)
        
        #执行hexo d命令
        deploy_command = "cd {} && hexo d".format(hexo_folder)
        execute_command(deploy_command)

        last_state = current_state
    
    time.sleep(1)  # 每隔1秒检测一次文件夹变更
```

请注意，请将代码中的文件夹路径替换为你自己博客的实际路径。
