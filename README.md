# 资料库

Rhythmus 工作台中的个人资料库，包含学习库、闪念库和做事方法库。

## 在外部服务器运行

GitHub 负责保存代码；完整资料库需要运行 Node 服务并连接 MySQL/TiDB，不能仅使用 GitHub Pages。

在 Render、Railway 或自有服务器创建 Web Service，使用仓库根目录的 `Dockerfile` 构建，并配置以下环境变量：

- `TIDB_HOST`
- `TIDB_PORT`
- `TIDB_DATABASE`
- `TIDB_USERNAME`
- `TIDB_PASSWORD`
- `LIBRARY_ACCESS_KEY`（生产环境必填，用于 Basic Auth 保护资料接口）
- `PORT=80`

服务监听 `0.0.0.0:80`，启动后访问平台分配的公网 HTTPS 地址。

> 不要把任何 `.env.*.local` 文件提交到 GitHub。
