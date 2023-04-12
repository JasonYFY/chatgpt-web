#!/bin/bash
# 备份当前index.html
cp index.html index.html.temp
# 还原初始的index.html
cp index.html.bak index.html
pnpm build
# 还原备份的index.html
cp index.html.temp index.html
