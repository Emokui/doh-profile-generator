"use strict";

(function attachProfileGenerator(globalObject) {
  const DOMAINS = Object.freeze([
    "ocsp.apple.com",
    "ocsp2.apple.com",
    "certs.apple.com",
    "crl.apple.com",
    "valid.apple.com",
    "appattest.apple.com",
    "vpp.itunes.apple.com",
  ]);

  function escapeXml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function createUuid() {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().toUpperCase();
    }

    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-").toUpperCase();
  }

  function normalizeDohUrl(rawValue) {
    const value = rawValue.trim();
    let url;

    try {
      url = new URL(value);
    } catch {
      throw new Error("请输入完整有效的 DoH 地址。");
    }

    if (url.protocol !== "https:") {
      throw new Error("DoH 地址必须使用 HTTPS。");
    }

    if (!url.hostname || url.username || url.password) {
      throw new Error("DoH 地址格式无效。");
    }

    url.hash = "";
    return url.toString();
  }

  function safeFilename(value) {
    const cleaned = value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return `${cleaned || "doh-domain-routing"}.mobileconfig`;
  }

  function normalizeDomains(rawValue) {
    const inputDomains = Array.isArray(rawValue)
      ? rawValue
      : String(rawValue).split(/\r?\n|,/);
    const domains = [];
    const seen = new Set();

    for (const rawDomain of inputDomains) {
      const domain = String(rawDomain)
        .trim()
        .toLowerCase()
        .replace(/\.$/, "");

      if (!domain) {
        continue;
      }

      if (
        domain.length > 253 ||
        domain.includes("://") ||
        domain.includes("/") ||
        domain.includes("*") ||
        !domain.includes(".") ||
        !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)
      ) {
        throw new Error(`域名格式无效：${rawDomain}`);
      }

      if (!seen.has(domain)) {
        seen.add(domain);
        domains.push(domain);
      }
    }

    if (domains.length === 0) {
      throw new Error("请至少填写一个分流域名。");
    }

    if (domains.length > 200) {
      throw new Error("分流域名最多支持 200 个。");
    }

    return domains;
  }

  function buildProfile(dohUrl, profileName, rawDomains = DOMAINS) {
    const domains = normalizeDomains(rawDomains);
    const profileUuid = createUuid();
    const dnsUuid = createUuid();
    const identifierSuffix = profileUuid.toLowerCase();
    const domainXml = domains
      .map((domain) => `                    <string>${escapeXml(domain)}</string>`)
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>DNSSettings</key>
            <dict>
                <key>DNSProtocol</key>
                <string>HTTPS</string>
                <key>ServerURL</key>
                <string>${escapeXml(dohUrl)}</string>
                <key>SupplementalMatchDomains</key>
                <array>
${domainXml}
                </array>
            </dict>
            <key>OnDemandRules</key>
            <array>
                <dict>
                    <key>Action</key>
                    <string>Connect</string>
                </dict>
            </array>
            <key>PayloadDescription</key>
            <string>仅将指定验证域名发送至配置的 DNS over HTTPS 服务。</string>
            <key>PayloadDisplayName</key>
            <string>${escapeXml(profileName)}</string>
            <key>PayloadIdentifier</key>
            <string>com.local.doh-profile.${identifierSuffix}.dns</string>
            <key>PayloadOrganization</key>
            <string>Local DoH Profile Generator</string>
            <key>PayloadType</key>
            <string>com.apple.dnsSettings.managed</string>
            <key>PayloadUUID</key>
            <string>${dnsUuid}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>仅将指定域名发送至 DoH，其他 DNS 查询继续使用系统 DNS。安装前请核对 DoH 地址。</string>
    <key>PayloadDisplayName</key>
    <string>${escapeXml(profileName)}</string>
    <key>PayloadIdentifier</key>
    <string>com.local.doh-profile.${identifierSuffix}</string>
    <key>PayloadOrganization</key>
    <string>Local DoH Profile Generator</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadScope</key>
    <string>User</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${profileUuid}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>
`;
  }

  globalObject.ProfileGenerator = Object.freeze({
    DOMAINS,
    buildProfile,
    normalizeDomains,
    normalizeDohUrl,
    safeFilename,
  });
})(typeof window !== "undefined" ? window : globalThis);
