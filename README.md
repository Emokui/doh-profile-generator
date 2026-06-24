# DoH 描述文件生成器

纯前端静态工具。用户输入 DNS over HTTPS 地址后，浏览器会在本地生成并下载 Apple `.mobileconfig` 文件。DoH 地址不会上传到服务器。

## 本地预览

在项目目录运行：

```bash
python3 -m http.server 8788 --directory public
```

打开 `http://localhost:8788`。

## 方式一：直接上传到 Cloudflare Pages

1. 进入 Cloudflare 控制台的 **Workers & Pages**。
2. 选择 **Create application → Get started → Drag and drop your files**。
3. 输入项目名称。
4. 上传 `doh-profile-generator-pages.zip`，或直接上传 `public` 文件夹。
5. 点击 **Deploy site**。

## 方式二：连接 GitHub 自动部署

先将整个项目目录推送到一个 GitHub 仓库，然后：

1. 进入 Cloudflare 控制台的 **Workers & Pages**。
2. 选择 **Create application → Pages → Connect to Git**。
3. 授权 GitHub，并选择对应仓库。
4. 使用以下构建设置：

   - Production branch：`main`
   - Framework preset：`None`
   - Build command：留空
   - Build output directory：`public`
   - Root directory：留空

5. 点击 **Save and Deploy**。

以后向 GitHub 的 `main` 分支推送修改，Cloudflare Pages 会自动重新部署。

## 项目结构

```text
doh-profile-generator/
├── public/
│   ├── _headers
│   ├── app.js
│   ├── index.html
│   ├── profile.js
│   └── styles.css
└── README.md
```

## 生成规则

- 只接受 `https://` DoH 地址。
- 每次生成新的 Payload UUID。
- 仅将页面中列出的域名路由到 DoH。
- 其他 DNS 查询继续使用设备的系统 DNS。
- 生成文件未签名，iOS 安装时会显示“未签名”。
