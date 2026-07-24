# CFDNS 双模式描述文件生成器

纯前端静态工具。用户输入 DNS over HTTPS 地址后，浏览器会在本地生成并下载 Apple `.mobileconfig` 文件。生成结果包含 `Normal` 和 `Install` 两个 DNS 选项，并且只使用一个 DoH 地址。DoH 地址不会上传到服务器。

## 本地预览

在项目目录运行：

```bash
python3 -m http.server 8788 --directory public
```

打开 `http://localhost:8788`。

## 自动检查

```bash
node tests/profile.test.js
```

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
├── tests/
│   └── profile.test.js
└── README.md
```

## 生成规则

- 只接受 `https://` DoH 地址。
- 每次生成三个不同的 Payload UUID：一个顶层描述文件和两个 DNS 载荷。
- `Normal` 使用输入的全部分流域名。
- `Install` 自动排除 `certs.apple.com` 和 `ppq.apple.com`，让它们使用设备的系统 DNS。
- `Normal` 使用 `NeverConnect` 让 `register.appattest.apple.com` 绕过 DoH；`Install` 会将其发送到 DoH。
- 两个模式使用同一个 DoH 地址。
- 默认包含当前 CFDNS 模板的 21 个域名，用户仍可逐行输入、删除或添加。
- 域名会自动转为小写、去重并检查格式，最多支持 200 个。
- Apple 的 `SupplementalMatchDomains` 使用后缀匹配，输入域名及其子域名都会路由到 DoH，无法在描述文件中关闭。
- Cloudflare Gateway 建议使用“20 项精确 Host 列表 OR `appattest.apple.com` Domain”策略。
- 关闭 Gateway 的“修改阻止行为”后，拦截的 A/AAAA 查询返回 `0.0.0.0`/`::`。
- 其他 DNS 查询继续使用设备的系统 DNS。
- 手动安装的 DNS Settings 描述文件也适用于蜂窝网络。
- 生成的组织/提供者名称为 `CloudFlare`。
- 生成文件未签名，iOS 安装时会显示“未签名”。

## 默认模式行为

```text
Normal
  - 21 个域名通过 DoH
  - register.appattest.apple.com 使用系统 DNS

Install
  - 19 个域名通过 DoH
  - certs.apple.com 和 ppq.apple.com 使用系统 DNS
  - register.appattest.apple.com 通过 DoH
```
