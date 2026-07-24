"use strict";

(function attachProfileGenerator(globalObject) {
  const DEFAULT_DOMAINS = Object.freeze([
    "ocsp.apple.com",
    "ocsp2.apple.com",
    "valid.apple.com",
    "crl.apple.com",
    "certs.apple.com",
    "appattest.apple.com",
    "vpp.itunes.apple.com",
    "ocsp2-lb.apple.com",
    "ocsp2.g.aaplimg.com",
    "crl3.digicert.com",
    "crl4.digicert.com",
    "ocsp.digicert.cn",
    "ocsp.digicert.com",
    "ocsp2-lb.apple.com.akadns.net",
    "crl5.digicert.com",
    "crl2.digicert.com",
    "crl.digicert.com",
    "crl2.apple.com",
    "crl3.apple.com",
    "ppq.apple.com",
    "mesu.apple.com",
  ]);
  const INSTALL_ONLY_EXCLUDED_DOMAINS = Object.freeze([
    "certs.apple.com",
    "ppq.apple.com",
  ]);
  const NORMAL_BYPASS_DOMAINS = Object.freeze([
    "register.appattest.apple.com",
  ]);
  const DEFAULT_ORGANIZATION = "CloudFlare";

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
      : String(rawValue).split(/\r?\n/);
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

  function buildProfile(
    dohUrl,
    profileName,
    rawDomains = DEFAULT_DOMAINS,
    organization = DEFAULT_ORGANIZATION,
  ) {
    const domains = normalizeDomains(rawDomains);
    const installDomains = domains.filter(
      (domain) => !INSTALL_ONLY_EXCLUDED_DOMAINS.includes(domain),
    );
    const normalBypassDomains = NORMAL_BYPASS_DOMAINS.filter((bypassDomain) =>
      domains.some(
        (domain) =>
          bypassDomain === domain || bypassDomain.endsWith(`.${domain}`),
      ),
    );

    if (installDomains.length === 0) {
      throw new Error("INSTALL 模式至少需要保留一个分流域名。");
    }

    const profileUuid = createUuid();
    const normalDnsUuid = createUuid();
    const installDnsUuid = createUuid();
    const identifierSuffix = profileUuid.toLowerCase();
    const normalDomainXml = domains
      .map((domain) => `                    <string>${escapeXml(domain)}</string>`)
      .join("\n");
    const installDomainXml = installDomains
      .map((domain) => `                    <string>${escapeXml(domain)}</string>`)
      .join("\n");
    const bypassDomainXml = normalBypassDomains
      .map((domain) => `                            <string>${escapeXml(domain)}</string>`)
      .join("\n");
    const normalOnDemandXml =
      normalBypassDomains.length > 0
        ? `            <key>OnDemandRules</key>
            <array>
                <dict>
                    <key>Action</key>
                    <string>EvaluateConnection</string>
                    <key>ActionParameters</key>
                    <array>
                        <dict>
                            <key>Domains</key>
                            <array>
${bypassDomainXml}
                            </array>
                            <key>DomainAction</key>
                            <string>NeverConnect</string>
                        </dict>
                    </array>
                </dict>
                <dict>
                    <key>Action</key>
                    <string>Connect</string>
                </dict>
            </array>`
        : `            <key>OnDemandRules</key>
            <array>
                <dict>
                    <key>Action</key>
                    <string>Connect</string>
                </dict>
            </array>`;
    const escapedName = escapeXml(profileName);
    const escapedOrganization = escapeXml(organization);

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
${normalDomainXml}
                </array>
            </dict>
${normalOnDemandXml}
            <key>PayloadDescription</key>
            <string>Normal mode: route the configured domains to the DoH server and bypass register.appattest.apple.com.</string>
            <key>PayloadDisplayName</key>
            <string>${escapedName} Normal</string>
            <key>PayloadIdentifier</key>
            <string>com.local.doh-profile.${identifierSuffix}.normal</string>
            <key>PayloadOrganization</key>
            <string>${escapedOrganization}</string>
            <key>PayloadType</key>
            <string>com.apple.dnsSettings.managed</string>
            <key>PayloadUUID</key>
            <string>${normalDnsUuid}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
        <dict>
            <key>DNSSettings</key>
            <dict>
                <key>DNSProtocol</key>
                <string>HTTPS</string>
                <key>ServerURL</key>
                <string>${escapeXml(dohUrl)}</string>
                <key>SupplementalMatchDomains</key>
                <array>
${installDomainXml}
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
            <string>Install mode: certs.apple.com and ppq.apple.com use the system resolver.</string>
            <key>PayloadDisplayName</key>
            <string>${escapedName} Install</string>
            <key>PayloadIdentifier</key>
            <string>com.local.doh-profile.${identifierSuffix}.install</string>
            <key>PayloadOrganization</key>
            <string>${escapedOrganization}</string>
            <key>PayloadType</key>
            <string>com.apple.dnsSettings.managed</string>
            <key>PayloadUUID</key>
            <string>${installDnsUuid}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>Two-mode split DNS profile using one DNS-over-HTTPS endpoint.</string>
    <key>PayloadDisplayName</key>
    <string>${escapedName}</string>
    <key>PayloadIdentifier</key>
    <string>com.local.doh-profile.${identifierSuffix}</string>
    <key>PayloadOrganization</key>
    <string>${escapedOrganization}</string>
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
    DEFAULT_ORGANIZATION,
    DEFAULT_DOMAINS,
    INSTALL_ONLY_EXCLUDED_DOMAINS,
    NORMAL_BYPASS_DOMAINS,
    buildProfile,
    normalizeDomains,
    normalizeDohUrl,
    safeFilename,
  });
})(typeof window !== "undefined" ? window : globalThis);
