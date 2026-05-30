// Esharq Client Installer  v1.14.13.0
// Copyright (c) 2026 LoSTSR / NRaymond. All rights reserved.
// Build: see build.ps1

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("Esharq Client Installer")]
[assembly: AssemblyDescription("Official installer for Esharq — the community Discord client mod")]
[assembly: AssemblyCompany("Esharq Digital Branding")]
[assembly: AssemblyProduct("Esharq")]
[assembly: AssemblyCopyright("© 2026 LoSTSR / NRaymond. All rights reserved.")]
[assembly: AssemblyVersion("1.14.13.0")]
[assembly: AssemblyFileVersion("1.14.13.0")]
[assembly: AssemblyTrademark("Esharq")]

// ─────────────────────────────────────────────────────────────────────
// Data model
// ─────────────────────────────────────────────────────────────────────

sealed class DiscordInstall
{
    public string Name;
    public string ResourcesPath;
    public bool   IsPatched;
    public string DisplayPath;
}

// ─────────────────────────────────────────────────────────────────────
// Logic  (pure static — zero UI dependency)
// ─────────────────────────────────────────────────────────────────────

static class Logic
{
    const string RELEASE_API  = "https://api.github.com/repos/LOSTSTR/Esharq/releases/latest";
    const string UA           = "Esharq-Installer/1.14.13.0 (+https://github.com/LOSTSTR/Esharq)";
    const string ASAR         = "desktop.asar";
    const string CHECKSUMS    = "checksums.txt";
    const string OPENASAR_URL = "https://github.com/GooseMod/OpenAsar/releases/download/nightly/app.asar";

    public static void InitNetwork()
    {
        try
        {
            ServicePointManager.SecurityProtocol =
                (SecurityProtocolType)3072 |
                (SecurityProtocolType)12288;
            ServicePointManager.DefaultConnectionLimit = 4;
        }
        catch { }
    }

    public static string DataDir
    {
        get
        {
            var env = Environment.GetEnvironmentVariable("EQUICORD_USER_DATA_DIR");
            if (!string.IsNullOrEmpty(env)) return env;
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            if (string.IsNullOrEmpty(appData))
                appData = Path.Combine(
                    Environment.GetEnvironmentVariable("USERPROFILE") ?? @"C:\Users\Default",
                    "AppData", "Roaming");
            return Path.Combine(appData, "Esharq");
        }
    }

    public static string AsarTarget { get { return Path.Combine(DataDir, "equicord.asar"); } }

    public static bool IsInstalled { get { return File.Exists(AsarTarget); } }

    public static List<DiscordInstall> FindDiscord()
    {
        var result = new List<DiscordInstall>();
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (string.IsNullOrEmpty(local))
        {
            var profile = Environment.GetEnvironmentVariable("USERPROFILE");
            if (!string.IsNullOrEmpty(profile))
                local = Path.Combine(profile, "AppData", "Local");
        }
        if (string.IsNullOrEmpty(local) || !Directory.Exists(local))
            return result;

        var names   = new[] { "Stable", "PTB", "Canary", "Development" };
        var folders = new[] { "Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment" };

        for (int i = 0; i < names.Length; i++)
        {
            try
            {
                var baseDir = Path.Combine(local, folders[i]);
                if (!Directory.Exists(baseDir)) continue;
                string[] appDirs;
                try { appDirs = Directory.GetDirectories(baseDir, "app-*"); }
                catch { continue; }
                if (appDirs == null || appDirs.Length == 0) continue;
                Array.Sort(appDirs);
                var res = Path.Combine(appDirs[appDirs.Length - 1], "resources");
                if (!Directory.Exists(res)) continue;
                result.Add(new DiscordInstall
                {
                    Name          = names[i],
                    ResourcesPath = res,
                    IsPatched     = File.Exists(Path.Combine(res, ASAR)),
                    DisplayPath   = baseDir,
                });
            }
            catch { }
        }
        return result;
    }

    public static string LatestTag()
    {
        try
        {
            using (var wc = MakeClient())
            {
                var json = wc.DownloadString(RELEASE_API);
                var m    = Regex.Match(json, "\"tag_name\"\\s*:\\s*\"([^\"]+)\"");
                return m.Success ? m.Groups[1].Value : "—";
            }
        }
        catch { return "—"; }
    }

    public static string LocalVersion()
    {
        if (!IsInstalled) return "—";
        try { return File.GetLastWriteTime(AsarTarget).ToString("yyyy-MM-dd"); }
        catch { return "مثبَّت"; }
    }

    static string GetAsarUrl(out string tag, out long size, out string checksumUrl)
    {
        tag = ""; size = 0; checksumUrl = "";
        using (var wc = MakeClient())
        {
            var json = wc.DownloadString(RELEASE_API);
            var tm   = Regex.Match(json, "\"tag_name\"\\s*:\\s*\"([^\"]+)\"");
            if (tm.Success) tag = tm.Groups[1].Value;

            // Scope to the assets section. We deliberately avoid trying to capture the
            // array body with a bracket regex: an asset's uploader login is
            // "github-actions[bot]", and the "]" inside it truncates a naive
            // \[([\s\S]+?)\] capture. Instead, pair each asset "name" with the next
            // "browser_download_url" (name always precedes the url within an asset).
            int ai = json.IndexOf("\"assets\"");
            if (ai < 0) return null;
            var region = json.Substring(ai);

            string asarUrl = null;
            foreach (Match m in Regex.Matches(region,
                "\"name\"\\s*:\\s*\"([^\"]+)\"[\\s\\S]*?\"browser_download_url\"\\s*:\\s*\"([^\"]+)\""))
            {
                var assetName = m.Groups[1].Value;
                var dl        = m.Groups[2].Value;
                if (assetName == ASAR)
                {
                    asarUrl = dl;
                    var sm = Regex.Match(m.Value, "\"size\"\\s*:\\s*(\\d+)");
                    if (sm.Success) long.TryParse(sm.Groups[1].Value, out size);
                }
                else if (assetName == CHECKSUMS)
                {
                    checksumUrl = dl;
                }
            }
            return asarUrl;
        }
    }

    static void Download(string url, string dest, Action<int, long, long> onProgress)
    {
        var req = (HttpWebRequest)WebRequest.Create(url);
        req.UserAgent       = UA;
        req.AllowAutoRedirect = true;
        req.Timeout           = 60000;
        using (var resp = (HttpWebResponse)req.GetResponse())
        using (var rs   = resp.GetResponseStream())
        using (var fs   = File.Create(dest))
        {
            long total = resp.ContentLength, done = 0;
            var  buf   = new byte[81920];
            int  n;
            while ((n = rs.Read(buf, 0, buf.Length)) > 0)
            {
                fs.Write(buf, 0, n);
                done += n;
                if (total > 0 && onProgress != null)
                    onProgress((int)(done * 100 / total), done, total);
            }
        }
    }

    static void ValidateDownloadUrl(string url)
    {
        Uri uri;
        if (!Uri.TryCreate(url, UriKind.Absolute, out uri))
            throw new Exception("عنوان URL غير صالح");
        if (uri.Scheme != "https")
            throw new Exception("يُسمح فقط بروتوكول HTTPS");
        if (!uri.Host.EndsWith("github.com", StringComparison.OrdinalIgnoreCase) &&
            !uri.Host.EndsWith("objects.githubusercontent.com", StringComparison.OrdinalIgnoreCase))
            throw new Exception("مصدر التنزيل غير موثوق: " + uri.Host);
    }

    static string ComputeSha256(string path)
    {
        using (var sha = SHA256.Create())
        using (var fs  = File.OpenRead(path))
        {
            var hash = sha.ComputeHash(fs);
            return BitConverter.ToString(hash).Replace("-", "").ToLower();
        }
    }

    static string FetchExpectedHash(string checksumUrl, string filename)
    {
        if (string.IsNullOrEmpty(checksumUrl)) return null;
        try
        {
            ValidateDownloadUrl(checksumUrl);
            using (var wc = MakeClient())
            {
                var text = wc.DownloadString(checksumUrl);
                foreach (var line in text.Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries))
                {
                    var parts = line.Trim().Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 2)
                    {
                        var name = parts[parts.Length - 1].TrimStart('*');
                        if (string.Equals(name, filename, StringComparison.OrdinalIgnoreCase))
                            return parts[0].ToLower();
                    }
                }
            }
        }
        catch { }
        return null;
    }

    public static void KillDiscord(string resourcesPath)
    {
        try
        {
            // Process name derived from the install path (e.g. "Discord", "DiscordPTB"),
            // plus the common variants as a safety net. Discord minimises to the tray and
            // spawns several child processes that all keep app.asar locked, so a single
            // Process.Kill() often leaves stragglers behind. taskkill /F /T force-kills the
            // whole process tree by image name; we loop until none remain.
            var discordRoot = Path.GetDirectoryName(Path.GetDirectoryName(resourcesPath));
            var derived = string.IsNullOrEmpty(discordRoot) ? null : Path.GetFileName(discordRoot);
            string[] names = { derived, "Discord", "DiscordCanary", "DiscordPTB", "DiscordDevelopment" };

            for (int round = 0; round < 6; round++)
            {
                bool any = false;
                foreach (var name in names)
                {
                    if (string.IsNullOrEmpty(name)) continue;
                    if (Process.GetProcessesByName(name).Length == 0) continue;
                    any = true;

                    // Force-kill the entire tree by image name (most reliable).
                    try
                    {
                        var psi = new ProcessStartInfo("taskkill", "/F /T /IM \"" + name + ".exe\"")
                        {
                            CreateNoWindow = true,
                            UseShellExecute = false,
                            WindowStyle = ProcessWindowStyle.Hidden
                        };
                        var tk = Process.Start(psi);
                        if (tk != null) tk.WaitForExit(3000);
                    }
                    catch { }

                    // Fallback: kill any survivors directly.
                    foreach (var p in Process.GetProcessesByName(name))
                        try { p.Kill(); p.WaitForExit(2000); } catch { }
                }
                if (!any) break;
                Thread.Sleep(500);
            }
            Thread.Sleep(400); // let Windows release the app.asar file handle
        }
        catch { }
    }

    // Overwriting app.asar can transiently fail if Windows hasn't released the handle
    // yet after Discord exits. Retry a few times before giving up with a clear message.
    static void CopyWithRetry(string src, string dest)
    {
        Exception last = null;
        for (int i = 0; i < 12; i++)
        {
            try { File.Copy(src, dest, true); return; }
            catch (Exception ex) { last = ex; Thread.Sleep(500); }
        }
        throw new Exception("تعذّر استبدال app.asar — تأكد أن Discord مغلق تماماً (بما في ذلك أيقونة شريط المهام) ثم أعد المحاولة. "
            + (last != null ? last.Message : ""));
    }

    public static void Install(string res, Action<string> status, Action<int> progress)
    {
        status("جارٍ جلب معلومات آخر إصدار...");
        progress(5);
        string tag, checksumUrl; long sz;
        var url = GetAsarUrl(out tag, out sz, out checksumUrl);
        if (string.IsNullOrEmpty(url))
            throw new Exception("لم يُعثر على ملف " + ASAR + " في أحدث إصدار");
        ValidateDownloadUrl(url);

        status(string.Format("تحميل {0}  ({1:F1} MB)...", tag, sz / 1048576.0));
        progress(10);
        Directory.CreateDirectory(DataDir);
        var tmp = Path.Combine(Path.GetTempPath(),
            "esharq_" + Guid.NewGuid().ToString("N") + ".asar");
        Download(url, tmp, (pct, dl, tot) =>
        {
            status(string.Format("تحميل: {0:F1}/{1:F1} MB  ({2}%)",
                dl / 1048576.0, tot / 1048576.0, pct));
            progress(10 + (int)(pct * 0.60));
        });

        status("جارٍ التحقق من سلامة الملف...");
        progress(75);
        var expectedHash = FetchExpectedHash(checksumUrl, ASAR);
        if (!string.IsNullOrEmpty(expectedHash))
        {
            var actualHash = ComputeSha256(tmp);
            if (!string.Equals(expectedHash, actualHash, StringComparison.OrdinalIgnoreCase))
            {
                try { File.Delete(tmp); } catch { }
                throw new Exception("فشل التحقق من SHA-256 — الملف تالف أو تم التلاعب به");
            }
        }

        status("جارٍ إغلاق Discord...");
        progress(82);
        KillDiscord(res);
        status("تطبيق التعديل على Discord...");
        progress(90);
        PatchDiscord(res, tmp);          // wire the mod into Discord's startup
        CopyWithRetry(tmp, AsarTarget);  // keep a copy for status/IsInstalled
        try { File.Delete(tmp); } catch { }
        progress(100);
        status("✓ تم التثبيت — أعد تشغيل Discord لتفعيل Esharq");
    }

    // Discord loads resources/app.asar. To inject, the original app.asar is backed
    // up to _app.asar (once) and the Esharq desktop.asar — whose package.json main
    // is patcher.js — is placed as app.asar. patcher.js then loads the original from
    // ../_app.asar at runtime. This mirrors the standard Vencord/Equicord model.
    static void PatchDiscord(string res, string modAsar)
    {
        var appAsar    = Path.Combine(res, "app.asar");
        var backupAsar = Path.Combine(res, "_app.asar");

        bool freshBackup = false;
        if (!File.Exists(backupAsar))
        {
            // First install: back up the REAL original. If _app.asar already exists,
            // app.asar is our previously-installed mod — never back that up.
            if (!File.Exists(appAsar))
                throw new Exception("لم يُعثر على app.asar في مجلد Discord — تأكد أنك اخترت مجلد resources الصحيح");
            File.Move(appAsar, backupAsar);
            freshBackup = true;
        }
        else if (File.Exists(appAsar))
        {
            try { File.Delete(appAsar); } catch { }
        }

        try
        {
            CopyWithRetry(modAsar, appAsar);
        }
        catch
        {
            // if we just moved the original and the copy failed, restore it so
            // Discord isn't left without an app.asar
            if (freshBackup && !File.Exists(appAsar) && File.Exists(backupAsar))
                try { File.Move(backupAsar, appAsar); } catch { }
            throw;
        }
    }

    public static void Uninstall(string res, Action<string> status, Action<int> progress)
    {
        status("جارٍ إزالة Esharq...");
        progress(20);
        KillDiscord(res);
        progress(50);

        // Restore the original Discord app.asar from the backup.
        var appAsar    = Path.Combine(res, "app.asar");
        var backupAsar = Path.Combine(res, "_app.asar");
        if (File.Exists(backupAsar))
        {
            if (File.Exists(appAsar)) { try { File.Delete(appAsar); } catch { } }
            File.Move(backupAsar, appAsar);   // _app.asar -> app.asar
        }
        progress(70);

        // Clean up the DataDir copy and any stray desktop.asar from older installs.
        if (File.Exists(AsarTarget)) File.Delete(AsarTarget);
        var stray = Path.Combine(res, ASAR);
        if (File.Exists(stray)) { try { File.Delete(stray); } catch { } }
        progress(100);
        status("✓ تمت الإزالة — أعد تشغيل Discord");
    }

    public static void InstallOpenAsar(string res, Action<string> status, Action<int> progress)
    {
        status("جارٍ إغلاق Discord...");
        progress(5);
        KillDiscord(res);
        status("جارٍ تنزيل OpenAsar...");
        progress(10);
        ValidateDownloadUrl(OPENASAR_URL);
        var tmp = Path.Combine(Path.GetTempPath(),
            "openasar_" + Guid.NewGuid().ToString("N") + ".asar");
        Download(OPENASAR_URL, tmp, (p, dl, tot) => progress(10 + (int)(p * 0.85)));
        status("تطبيق OpenAsar...");
        progress(97);
        CopyWithRetry(tmp, Path.Combine(res, "app.asar"));
        try { File.Delete(tmp); } catch { }
        progress(100);
        status("✓ تم تثبيت OpenAsar — أعد تشغيل Discord");
    }

    static WebClient MakeClient()
    {
        var wc = new WebClient();
        wc.Headers[HttpRequestHeader.UserAgent] = UA;
        return wc;
    }
}

// ─────────────────────────────────────────────────────────────────────
// InstallerForm — sidebar layout  1050 × 650  (borderless)
//
// Crash-safe rules enforced throughout:
//   • NO GraphicsPath inside any Paint/OnPaint — zero risk of GDI null-brush crash
//   • NO Color.Transparent on Panel or Button — only safe on Label/LinkLabel
//   • Card borders via nested panels (outer=border color, inner=surface)
//   • Progress via resizing Panel, not custom control
//   • All cross-thread updates through SafeInvoke — no Application.DoEvents
//   • _suppressEvents guards card-click cascade
//
// Layout (ClientSize 1050 × 650):
//   Sidebar  0,0   240 × 650
//   Main   240,0   810 × 650
//     Close btn  top-right of main
//     HomeCanvas   y=40
//     AboutCanvas  y=40
// ─────────────────────────────────────────────────────────────────────

sealed class InstallerForm : Form
{
    // ── Palette ───────────────────────────────────────────────────────
    static readonly Color BG         = Color.FromArgb( 15,  19,  29);
    static readonly Color SIDEBAR    = Color.FromArgb( 22,  25,  37);
    static readonly Color CARD       = Color.FromArgb( 29,  35,  51);
    static readonly Color CARD_B     = Color.FromArgb( 45,  52,  70);
    static readonly Color ACCENT     = Color.FromArgb(109,  68, 246);
    static readonly Color SUCCESS    = Color.FromArgb( 46, 164,  79);
    static readonly Color BLUE       = Color.FromArgb( 88, 101, 242);
    static readonly Color DANGER     = Color.FromArgb(215,  58,  73);
    static readonly Color SLATE      = Color.FromArgb( 40,  45,  55);
    static readonly Color BORDER_DIM = Color.FromArgb( 50,  55,  70);
    static readonly Color TEXT_PRI   = Color.FromArgb(245, 245, 247);
    static readonly Color TEXT_SEC   = Color.FromArgb(150, 160, 180);
    static readonly Color TEXT_MUTED = Color.FromArgb(100, 110, 130);
    static readonly Color WARN_BG    = Color.FromArgb( 33,  30,  24);
    static readonly Color WARN_BDR   = Color.FromArgb(130, 100,  30);
    static readonly Color WARN_TTL   = Color.FromArgb(255, 190,  40);
    static readonly Color WARN_BODY  = Color.FromArgb(230, 210, 180);

    const string DISCORD_URL = "https://discord.gg/kDJYqWX3S3";
    const string GITHUB_URL  = "https://github.com/LOSTSTR/Esharq";
    const string VER         = "1.14.13.0";

    // ── Language ──────────────────────────────────────────────────────
    static bool _arabic = true;
    static string T(string ar, string en) { return _arabic ? ar : en; }

    // Borderless-window drag
    [DllImport("user32.dll")] static extern int  SendMessage(IntPtr h, int m, int w, int l);
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    const int WM_NCLBUTTONDOWN = 0xA1;
    const int HT_CAPTION       = 0x2;

    // Controls
    Button  _btnNavHome, _btnNavAbout;
    Panel   _homeCanvas, _aboutCanvas;
    Label   _lblFileStatus, _lblStatus;
    Panel   _progFill;
    Button  _btnInstall, _btnRepair, _btnRemove, _btnOpenAsar;
    Button  _btnLangAR, _btnLangEN;
    Panel   _sidebarPanel, _mainAreaPanel;

    // Discord picker
    List<DiscordInstall> _installs = new List<DiscordInstall>();
    Panel[]     _cardBorders = new Panel[2];
    int         _selectedCard;
    TextBox     _txtCustom;
    Button      _btnBrowse;
    bool        _suppressEvents;

    public InstallerForm()
    {
        SuspendLayout();
        SetupWindow();
        BuildSidebar();
        BuildMainArea();
        Shown += OnShown;
        ResumeLayout(true);
    }

    // ── Window ───────────────────────────────────────────────────────

    // Forces taskbar button on borderless windows (WS_EX_APPWINDOW)
    protected override CreateParams CreateParams
    {
        get
        {
            const int WS_EX_APPWINDOW = 0x00040000;
            CreateParams cp = base.CreateParams;
            cp.ExStyle |= WS_EX_APPWINDOW;
            return cp;
        }
    }

    void SetupWindow()
    {
        Text            = "Esharq";
        ClientSize      = new Size(1050, 650);
        BackColor       = BG;
        StartPosition   = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar   = true;
        Font            = new Font("Segoe UI", 10f);

        // Load icon from the EXE's own embedded Win32 resources (no external file needed)
        try
        {
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        }
        catch
        {
            try
            {
                var ico = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "icon.ico");
                if (File.Exists(ico)) Icon = new Icon(ico);
            }
            catch { }
        }
    }

    // ── Sidebar (0,0,240,650) ────────────────────────────────────────

    void BuildSidebar()
    {
        var sb = MakePanel(0, 0, 240, 650, SIDEBAR);
        _sidebarPanel = sb;
        Controls.Add(sb);
        sb.MouseDown += OnDrag;

        // Logo
        sb.Controls.Add(MakeLabel("Esharq", 22, 30, TEXT_PRI, 20f, FontStyle.Bold, sb));

        // Version badge
        var ver = new Label
        {
            Text      = "v" + VER,
            Location  = new Point(135, 43),
            Size      = new Size(74, 20),
            ForeColor = TEXT_MUTED,
            BackColor = Color.FromArgb(35, 40, 55),
            Font      = new Font("Segoe UI", 8f, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleCenter,
        };
        sb.Controls.Add(ver);

        // Separator
        sb.Controls.Add(MakePanel(20, 80, 200, 1, Color.FromArgb(35, 40, 55)));

        // Nav buttons
        _btnNavHome  = MakeSidebarBtn(T("🏠  الواجهة الرئيسية", "🏠  Home"), 100, sb);
        _btnNavAbout = MakeSidebarBtn(T("ℹ  حول التطبيق", "ℹ  About"), 150, sb);
        _btnNavHome.Click  += (s, e) => SwitchTab(true);
        _btnNavAbout.Click += (s, e) => SwitchTab(false);
        SetNavActive(_btnNavHome);

        // Security card
        var secOuter = MakePanel(20, 450, 200, 132, Color.FromArgb(38, 43, 60));
        sb.Controls.Add(secOuter);
        var secInner = MakePanel(1, 1, 198, 130, Color.FromArgb(28, 32, 48));
        secOuter.Controls.Add(secInner);

        secInner.Controls.Add(MakeLabel("🛡", 82, 10, ACCENT, 16f, FontStyle.Regular, secInner));
        secInner.Controls.Add(MakeLabel(T("أمان وموثوقية", "Security & Trust"),
            10, 40, TEXT_PRI, 10f, FontStyle.Bold, secInner, 178, 22, ContentAlignment.MiddleCenter));
        secInner.Controls.Add(MakeLabel(
            T("تم تصميم Esharq بأعلى معايير الأمان\nوالخصوصية لضمان تجربة آمنة ومستقرة.",
              "Esharq is built with the highest security\nand privacy standards for a safe experience."),
            10, 66, TEXT_SEC, 8f, FontStyle.Regular, secInner, 178, 36, ContentAlignment.MiddleCenter));

        var badge = new Label
        {
            Text      = T("✔ التطبيق موثوق", "✔ App Verified"),
            Location  = new Point(10, 106),
            Size      = new Size(178, 20),
            ForeColor = SUCCESS,
            BackColor = Color.FromArgb(20, 40, 30),
            Font      = new Font("Segoe UI", 8.5f, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleCenter,
        };
        secInner.Controls.Add(badge);

        // Bottom socials — GitHub • Discord (centered in 240px sidebar)
        sb.Controls.Add(MakePanel(20, 600, 200, 1, Color.FromArgb(35, 40, 55)));
        sb.Controls.Add(MakeLink("GitHub", 60, 615, 8.5f, sb, GITHUB_URL));
        sb.Controls.Add(MakeLabel("•", 108, 616, TEXT_MUTED, 8.5f, FontStyle.Regular, sb));
        sb.Controls.Add(MakeLink("Discord", 120, 615, 8.5f, sb, DISCORD_URL));
    }

    Button MakeSidebarBtn(string text, int y, Panel parent)
    {
        var b = new Button
        {
            Text      = text,
            Location  = new Point(10, y),
            Size      = new Size(220, 40),
            FlatStyle = FlatStyle.Flat,
            ForeColor = TEXT_SEC,
            BackColor = SIDEBAR,
            Font      = new Font("Segoe UI", 10f),
            TextAlign = ContentAlignment.MiddleRight,
            RightToLeft = RightToLeft.Yes,
        };
        b.FlatAppearance.BorderSize             = 0;
        b.FlatAppearance.MouseOverBackColor     = Color.FromArgb(35, 40, 55);
        b.UseVisualStyleBackColor               = false;
        parent.Controls.Add(b);
        return b;
    }

    void SetNavActive(Button active)
    {
        var all = new[] { _btnNavHome, _btnNavAbout };
        foreach (var b in all)
        {
            if (b == null) continue;
            bool on = (b == active);
            b.BackColor = on ? ACCENT : SIDEBAR;
            b.ForeColor = on ? TEXT_PRI : TEXT_SEC;
        }
    }

    // ── Main area (240,0,810,650) ────────────────────────────────────

    void BuildMainArea()
    {
        var main = MakePanel(240, 0, 810, 650, BG);
        _mainAreaPanel = main;
        Controls.Add(main);
        main.MouseDown += OnDrag;

        // ── Language toggle buttons ───────────────────────
        _btnLangAR = MakeFlatBtn("ع", 686, 10, 32, 28, _arabic ? ACCENT : SLATE, TEXT_PRI);
        _btnLangEN = MakeFlatBtn("EN", 720, 10, 42, 28, _arabic ? SLATE : ACCENT, TEXT_PRI);
        _btnLangAR.Font = new Font("Segoe UI", 10f, FontStyle.Bold);
        _btnLangEN.Font = new Font("Segoe UI", 8.5f, FontStyle.Bold);
        _btnLangAR.FlatAppearance.BorderSize = 1;
        _btnLangEN.FlatAppearance.BorderSize = 1;
        _btnLangAR.FlatAppearance.BorderColor = BORDER_DIM;
        _btnLangEN.FlatAppearance.BorderColor = BORDER_DIM;
        _btnLangAR.Click += (s, e) => SwitchLanguage(true);
        _btnLangEN.Click += (s, e) => SwitchLanguage(false);
        main.Controls.Add(_btnLangAR);
        main.Controls.Add(_btnLangEN);

        // ── Close button ──────────────────────────────────
        var btnClose = MakeFlatBtn("✕", 770, 10, 32, 28, BG, TEXT_MUTED);
        btnClose.FlatAppearance.MouseOverBackColor = DANGER;
        btnClose.Click += (s, e) => Application.Exit();
        main.Controls.Add(btnClose);

        _homeCanvas  = BuildHomeCanvas();
        _aboutCanvas = BuildAboutCanvas();
        main.Controls.Add(_homeCanvas);
        main.Controls.Add(_aboutCanvas);
        _homeCanvas.Visible  = true;
        _aboutCanvas.Visible = false;
    }

    void SwitchLanguage(bool arabic)
    {
        if (_arabic == arabic) return;
        _arabic = arabic;

        // Update toggle button colors
        if (_btnLangAR != null) _btnLangAR.BackColor = arabic ? ACCENT : SLATE;
        if (_btnLangEN != null) _btnLangEN.BackColor = arabic ? SLATE : ACCENT;

        bool wasHome = _homeCanvas != null && _homeCanvas.Visible;

        SuspendLayout();

        // Rebuild sidebar
        if (_sidebarPanel != null) { Controls.Remove(_sidebarPanel); _sidebarPanel.Dispose(); _sidebarPanel = null; }
        _btnNavHome = null; _btnNavAbout = null;
        BuildSidebar();

        // Rebuild canvases
        if (_homeCanvas  != null) { _mainAreaPanel.Controls.Remove(_homeCanvas);  _homeCanvas.Dispose();  }
        if (_aboutCanvas != null) { _mainAreaPanel.Controls.Remove(_aboutCanvas); _aboutCanvas.Dispose(); }
        _lblFileStatus = null; _lblStatus = null; _progFill = null;
        _btnInstall = null; _btnRepair = null; _btnRemove = null; _btnOpenAsar = null;
        _cardBorders = new Panel[2]; _txtCustom = null; _btnBrowse = null;
        _installs = Logic.FindDiscord();

        _homeCanvas  = BuildHomeCanvas();
        _aboutCanvas = BuildAboutCanvas();
        _mainAreaPanel.Controls.Add(_homeCanvas);
        _mainAreaPanel.Controls.Add(_aboutCanvas);
        _homeCanvas.Visible  = wasHome;
        _aboutCanvas.Visible = !wasHome;
        SetNavActive(wasHome ? _btnNavHome : _btnNavAbout);

        ResumeLayout(true);
        OnShown(null, null);
    }

    // ── Home canvas (0,40,810,600) ───────────────────────────────────

    Panel BuildHomeCanvas()
    {
        var c = MakePanel(0, 40, 810, 600, BG);
        c.MouseDown += OnDrag;

        // Title + subtitle
        c.Controls.Add(MakeLabel("Esharq", 40, 14, TEXT_PRI, 26f, FontStyle.Bold, c));
        c.Controls.Add(MakeLabel(T("أداة تثبيت متقدمة وسهلة لمشروع LOSTSTR/Esharq",
                                   "Advanced and easy installer for LOSTSTR/Esharq"),
            46, 60, TEXT_SEC, 11f, FontStyle.Regular, c));

        // ── Path card (y=95) ──────────────────────────
        var pathOuter = MakePanel(40, 95, 730, 90, CARD_B);
        c.Controls.Add(pathOuter);
        var pathInner = MakePanel(1, 1, 728, 88, CARD);
        pathOuter.Controls.Add(pathInner);

        // Top row: title (right) + open-folder button (left) — no emoji in button (GDI can't render them)
        pathInner.Controls.Add(MakeLabel(T("ملف التثبيت", "Install File"), 572, 12, TEXT_PRI, 10.5f, FontStyle.Bold, pathInner));
        var btnOpen = MakeFlatBtn(T("فتح المجلد", "Open Folder"), 12, 10, 130, 34, ACCENT, TEXT_PRI);
        btnOpen.Click += (s, e) =>
        {
            try { Directory.CreateDirectory(Logic.DataDir); Process.Start("explorer.exe", Logic.DataDir); }
            catch { }
        };
        pathInner.Controls.Add(btnOpen);

        // Bottom row: path (left) + status (right) — placed below button to avoid overlap
        pathInner.Controls.Add(MakeLabel(ShortenPath(Logic.AsarTarget),
            12, 52, Color.FromArgb(180, 190, 210), 9f, FontStyle.Regular, pathInner, 580, 18));
        _lblFileStatus = MakeLabel(T("يتم التحقق...", "Checking..."), 505, 68, TEXT_MUTED, 9f, FontStyle.Bold, pathInner);
        pathInner.Controls.Add(_lblFileStatus);

        // ── Warning banner (y=200) ────────────────────
        var warnOuter = MakePanel(40, 200, 730, 112, WARN_BDR);
        c.Controls.Add(warnOuter);
        var warnInner = MakePanel(1, 1, 728, 110, WARN_BG);
        warnOuter.Controls.Add(warnInner);

        warnInner.Controls.Add(MakeLabel("⚠", 14, 10, WARN_TTL, 14f, FontStyle.Regular, warnInner));
        warnInner.Controls.Add(MakeLabel(T("هام جداً", "Important"), 622, 12, WARN_TTL, 11f, FontStyle.Bold, warnInner));
        warnInner.Controls.Add(MakeLabel(
            T("مستودع LOSTSTR/Esharq على GitHub هو المصدر الرسمي الوحيد للحصول على حزمة Esharq بشكل آمن.\n" +
              "أي مصدر آخر يُعدّ ضاراً. إذا قمت بتنزيله من مكان آخر، قم بإزالة التثبيت فوراً لحماية حسابك\n" +
              "وكلمة مرور Discord.",
              "The LOSTSTR/Esharq GitHub repository is the only official source for Esharq.\n" +
              "Any other source is considered harmful. If you downloaded it from elsewhere,\n" +
              "uninstall immediately to protect your Discord account and password."),
            20, 40, WARN_BODY, 9.5f, FontStyle.Regular, warnInner, 696, 66));

        // ── Section label (y=326) ─────────────────────
        c.Controls.Add(MakeLabel(T("لتعديل عليها  Discord  الرجاء اختيار نسخة",
                                   "Please select a Discord version to modify"),
            40, 326, TEXT_PRI, 10.5f, FontStyle.Bold, c));

        // ── Discord cards (y=350) ─────────────────────
        _installs = Logic.FindDiscord();
        BuildDiscordCards(c);

        // ── Custom path row (y=442) ───────────────────
        _txtCustom = new TextBox
        {
            Location    = new Point(150, 442),
            Size        = new Size(494, 26),
            BackColor   = Color.FromArgb(35, 40, 55),
            ForeColor   = TEXT_MUTED,
            BorderStyle = BorderStyle.FixedSingle,
            Font        = new Font("Segoe UI", 9f),
            Text        = T("اختر مسار مخصص...", "Choose a custom path..."),
            Enabled     = false,
        };
        c.Controls.Add(_txtCustom);

        _btnBrowse = MakeFlatBtn(T("استعراض", "Browse"), 40, 442, 100, 26, SLATE, TEXT_SEC);
        _btnBrowse.FlatAppearance.BorderColor = BORDER_DIM;
        _btnBrowse.FlatAppearance.BorderSize  = 1;
        _btnBrowse.Enabled = false;
        _btnBrowse.Click += (s, e) =>
        {
            using (var dlg = new FolderBrowserDialog())
            {
                dlg.Description = T("اختر مجلد resources الخاص بـ Discord", "Select the Discord resources folder");
                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    _txtCustom.Text      = dlg.SelectedPath;
                    _txtCustom.ForeColor = TEXT_PRI;
                }
            }
        };
        c.Controls.Add(_btnBrowse);

        // ── Progress track (y=476) ────────────────────
        var progTrack = MakePanel(40, 476, 730, 4, Color.FromArgb(34, 36, 42));
        c.Controls.Add(progTrack);
        _progFill = MakePanel(0, 0, 0, 4, SUCCESS);
        progTrack.Controls.Add(_progFill);

        // Status
        _lblStatus = new Label
        {
            Text      = T("جاهز — اختر نسخة Discord ثم اضغط تثبيت", "Ready — select a Discord version then press Install"),
            Location  = new Point(40, 484),
            Size      = new Size(730, 20),
            ForeColor = TEXT_MUTED,
            BackColor = BG,
            Font      = new Font("Segoe UI", 9f),
        };
        c.Controls.Add(_lblStatus);

        // ── 4 action buttons (y=530) ──────────────────
        // No emoji in buttons — GDI (.NET 4.0) cannot render supplementary-plane characters
        _btnInstall  = MakeFlatBtn(T("تثبيت  ✓",                    "Install  ✓"),           40,  514, 170, 46, SUCCESS, Color.White);
        _btnRepair   = MakeFlatBtn(T("إعادة التثبيت / الإصلاح  ↺", "Reinstall / Repair  ↺"), 220,  514, 195, 46, BLUE,    Color.White);
        _btnRemove   = MakeFlatBtn(T("إزالة التثبيت",               "Uninstall"),             425,  514, 170, 46, DANGER,  Color.White);
        _btnOpenAsar = MakeFlatBtn(T("تثبيت OpenAsar",              "Install OpenAsar"),      605,  514, 165, 46, SLATE,   Color.White);

        foreach (var b in new[] { _btnInstall, _btnRepair, _btnRemove, _btnOpenAsar })
            b.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);

        _btnInstall.Click  += OnInstall;
        _btnRepair.Click   += OnRepair;
        _btnRemove.Click   += OnRemove;
        _btnOpenAsar.Click += OnOpenAsar;

        c.Controls.Add(_btnInstall);
        c.Controls.Add(_btnRepair);
        c.Controls.Add(_btnRemove);
        c.Controls.Add(_btnOpenAsar);

        // ── Footer strip (must end at exactly y=600 — canvas height limit) ──
        var ftSep = MakePanel(0, 577, 810, 1, BORDER_DIM);
        c.Controls.Add(ftSep);

        var ft = MakePanel(0, 578, 810, 22, SIDEBAR);
        c.Controls.Add(ft);

        ft.Controls.Add(MakeLink(T("LOSTSTR/Esharq على GitHub  ↗", "LOSTSTR/Esharq on GitHub  ↗"), 14, 3, 8.5f, ft, GITHUB_URL));
        ft.Controls.Add(MakeLabel("© 2026 Esharq. مرخص بموجب GPL-3.0", 545, 3, TEXT_MUTED, 8.5f, FontStyle.Regular, ft));

        return c;
    }

    void BuildDiscordCards(Panel c)
    {
        DiscordInstall detected = _installs.Count > 0 ? _installs[0] : null;
        bool avail = detected != null;

        // Card 0 — auto-detected install (left)
        var c0Outer = MakePanel(40, 350, 355, 82, ACCENT);
        c.Controls.Add(c0Outer);
        _cardBorders[0] = c0Outer;

        var c0Inner = MakePanel(1, 1, 353, 80, CARD);
        c0Outer.Controls.Add(c0Inner);

        string c0Name = avail
            ? string.Format(T("نسخة {0}  (موصى بها)  🛡", "{0}  (Recommended)  🛡"), detected.Name)
            : "Discord Stable  🛡";
        c0Inner.Controls.Add(MakeLabel(c0Name,
            avail ? 180 : 200, 10, avail ? TEXT_PRI : TEXT_MUTED, 9.5f, FontStyle.Bold, c0Inner));

        if (avail)
        {
            string dp = detected.DisplayPath.Length > 44
                ? "..." + detected.DisplayPath.Substring(detected.DisplayPath.Length - 41)
                : detected.DisplayPath;
            c0Inner.Controls.Add(MakeLabel(dp, 10, 34, TEXT_MUTED, 8.5f, FontStyle.Regular, c0Inner, 335, 18));
            var sc = detected.IsPatched ? SUCCESS : Color.FromArgb(100, 200, 130);
            var st = detected.IsPatched
                ? T("✔ Esharq مُثبَّت", "✔ Esharq Installed")
                : T("✔ الأكثر استقراراً وأماناً", "✔ Most stable and secure");
            c0Inner.Controls.Add(MakeLabel(st, 210, 56, sc, 8.5f, FontStyle.Bold, c0Inner));
        }
        else
        {
            c0Inner.Controls.Add(MakeLabel(T("غير مثبَّت على هذا الجهاز", "Not installed on this device"),
                180, 34, TEXT_MUTED, 8.5f, FontStyle.Regular, c0Inner));
        }

        EventHandler sel0 = (s, e) => { if (avail) SelectCard(0); };
        c0Outer.Click += sel0;
        c0Inner.Click += sel0;
        foreach (Control ctl in c0Inner.Controls) ctl.Click += sel0;

        // Card 1 — custom path (right)
        var c1Outer = MakePanel(405, 350, 365, 82, BORDER_DIM);
        c.Controls.Add(c1Outer);
        _cardBorders[1] = c1Outer;

        var c1Inner = MakePanel(1, 1, 363, 80, CARD);
        c1Outer.Controls.Add(c1Inner);

        c1Inner.Controls.Add(MakeLabel(T("مسار تثبيت مخصص  📁", "Custom Install Path  📁"),
            185, 10, TEXT_SEC, 9.5f, FontStyle.Bold, c1Inner));
        c1Inner.Controls.Add(MakeLabel(T("اختر مسار تثبيت Discord يدوياً من جهازك",
                                         "Manually select your Discord install path"),
            90, 34, TEXT_MUTED, 8.5f, FontStyle.Regular, c1Inner, 270, 18));

        var folderIcon = new Label
        {
            Text      = "📁",
            Location  = new Point(316, 18),
            AutoSize  = true,
            Font      = new Font("Segoe UI", 18f),
            BackColor = CARD,
            ForeColor = TEXT_MUTED,
        };
        c1Inner.Controls.Add(folderIcon);

        EventHandler sel1 = (s, e) => SelectCard(1);
        c1Outer.Click += sel1;
        c1Inner.Click += sel1;
        foreach (Control ctl in c1Inner.Controls) ctl.Click += sel1;

        // Auto-select
        _suppressEvents = true;
        _selectedCard = avail ? 0 : 1;
        _cardBorders[0].BackColor = (_selectedCard == 0) ? ACCENT : BORDER_DIM;
        _cardBorders[1].BackColor = (_selectedCard == 1) ? ACCENT : BORDER_DIM;
        _suppressEvents = false;
    }

    void SelectCard(int idx)
    {
        if (_suppressEvents) return;
        _suppressEvents = true;
        try
        {
            _selectedCard = idx;
            _cardBorders[0].BackColor = (idx == 0) ? ACCENT : BORDER_DIM;
            _cardBorders[1].BackColor = (idx == 1) ? ACCENT : BORDER_DIM;

            bool custom = (idx == 1);
            if (_txtCustom  != null) { _txtCustom.Enabled = custom; _txtCustom.ForeColor = custom ? TEXT_PRI : TEXT_MUTED; }
            if (_btnBrowse  != null) _btnBrowse.Enabled = custom;
        }
        finally { _suppressEvents = false; }
        UpdatePrimaryButton();
    }

    // ── About canvas ─────────────────────────────────────────────────

    Panel BuildAboutCanvas()
    {
        var c = MakePanel(0, 40, 810, 600, BG);

        c.Controls.Add(MakeLabel(T("حول التطبيق", "About"), 40, 14, TEXT_PRI, 24f, FontStyle.Bold, c));

        // Info card
        var infoO = MakePanel(40, 70, 730, 150, CARD_B);
        c.Controls.Add(infoO);
        var infoI = MakePanel(1, 1, 728, 148, CARD);
        infoO.Controls.Add(infoI);

        infoI.Controls.Add(MakeLabel(T("معلومات الحزمة والنسخة", "Package & Version Info"), 518, 14, ACCENT, 11f, FontStyle.Bold, infoI));
        infoI.Controls.Add(MakeLabel(
            T("•  إصدار المثبت: v" + VER + "  (مايو 2026)\n" +
              "•  النواة البرمجية: .NET Framework 4.0 — WinForms\n" +
              "•  التوافقية: Windows 10/11 x64 بما فيها LTSC\n" +
              "•  تصميم آمن: بدون GDI مخصص أو OnPaint overrides",
              "•  Installer version: v" + VER + "  (May 2026)\n" +
              "•  Runtime: .NET Framework 4.0 — WinForms\n" +
              "•  Compatibility: Windows 10/11 x64 including LTSC\n" +
              "•  Secure design: no custom GDI or OnPaint overrides"),
            100, 46, TEXT_SEC, 9.5f, FontStyle.Regular, infoI, 620, 90));

        // Team card — expanded to fit full roster
        var teamO = MakePanel(40, 240, 730, 222, CARD_B);
        c.Controls.Add(teamO);
        var teamI = MakePanel(1, 1, 728, 220, CARD);
        teamO.Controls.Add(teamI);

        teamI.Controls.Add(MakeLabel(T("فريق التطوير", "Development Team"), 572, 14, SUCCESS, 11f, FontStyle.Bold, teamI));

        // Role badge helper: colored dot + name + separator + role
        int rowY = 44;
        Action<string, string, Color, string> addMember = (name, role, col, icon) =>
        {
            teamI.Controls.Add(MakeLabel(icon, 680, rowY, col, 9f, FontStyle.Bold, teamI));
            teamI.Controls.Add(MakeLabel(name, 620, rowY, TEXT_PRI, 9f, FontStyle.Bold, teamI));
            teamI.Controls.Add(MakeLabel("—  " + role, 10, rowY, TEXT_SEC, 9f, FontStyle.Regular, teamI, 600, 18));
            rowY += 22;
        };

        addMember("LOSTSTR",     T("مطور رئيسي — بناء المشروع وإدارته",        "Lead developer — project build & management"), ACCENT,  "★");
        addMember("krym511",     T("داعم رئيسي — دعم ومساهمة في التطوير",      "Main supporter — support & development"),      SUCCESS, "◆");
        addMember("iosiph",      T("مساهم في التطوير",                           "Contributor"),                                  BLUE,    "●");
        addMember("RAYMOND",     T("مساهم في التطوير",                           "Contributor"),                                  BLUE,    "●");
        addMember("Abo Ahmed",   T("مساهم في التطوير",                           "Contributor"),                                  BLUE,    "●");
        addMember("S99",         T("مساهم في التطوير",                           "Contributor"),                                  BLUE,    "●");
        addMember(".fmo",        T("مساهم في التطوير",                           "Contributor"),                                  BLUE,    "●");

        teamI.Controls.Add(MakeLink("GitHub  ↗", 580, 200, 9f, teamI, GITHUB_URL));
        teamI.Controls.Add(MakeLink("Discord  ↗", 496, 200, 9f, teamI, DISCORD_URL));

        // License card
        var licO = MakePanel(40, 480, 730, 50, CARD_B);
        c.Controls.Add(licO);
        var licI = MakePanel(1, 1, 728, 48, CARD);
        licO.Controls.Add(licI);
        licI.Controls.Add(MakeLabel(
            T("الرخصة: GPL-3.0  ·  المصدر الرسمي فقط: github.com/LOSTSTR/Esharq",
              "License: GPL-3.0  ·  Official source only: github.com/LOSTSTR/Esharq"),
            30, 14, TEXT_MUTED, 9f, FontStyle.Regular, licI));

        return c;
    }

    // ── Tab switching ─────────────────────────────────────────────────

    void SwitchTab(bool home)
    {
        _homeCanvas.Visible  = home;
        _aboutCanvas.Visible = !home;
        SetNavActive(home ? _btnNavHome : _btnNavAbout);
    }

    // ── Shown ─────────────────────────────────────────────────────────

    void OnShown(object sender, EventArgs e)
    {
        UpdatePrimaryButton();

        bool inst = Logic.IsInstalled;
        if (_lblFileStatus != null)
        {
            _lblFileStatus.Text      = inst ? T("✔ تم التحقق من الملف بنجاح", "✔ File verified successfully")
                                             : T("ℹ لم يُثبَّت بعد", "ℹ Not installed yet");
            _lblFileStatus.ForeColor = inst ? SUCCESS : TEXT_MUTED;
        }
    }

    // ── State-aware primary button ────────────────────────────────────

    void UpdatePrimaryButton()
    {
        if (_btnInstall == null) return;
        if (Logic.IsInstalled)
        {
            _btnInstall.Text      = T("تحميل Esharq  ↑", "Download Esharq  ↑");
            _btnInstall.BackColor = BLUE;
            _btnInstall.FlatAppearance.MouseOverBackColor = Color.FromArgb(110, 120, 250);
        }
        else
        {
            _btnInstall.Text      = T("تثبيت  ✓", "Install  ✓");
            _btnInstall.BackColor = SUCCESS;
            _btnInstall.FlatAppearance.MouseOverBackColor = Color.FromArgb(68, 185, 100);
        }
    }

    // ── Target resolution ─────────────────────────────────────────────

    bool TryGetTarget(out string path)
    {
        path = null;
        try
        {
            if (_selectedCard == 1)
            {
                var p = (_txtCustom != null ? _txtCustom.Text : "").Trim();
                if (string.IsNullOrEmpty(p) || !Directory.Exists(p))
                    throw new Exception(T("المسار المخصص غير صحيح أو غير موجود", "Custom path is invalid or does not exist"));
                path = p;
                return true;
            }
            if (_installs.Count == 0)
                throw new Exception(T("لم يُعثر على Discord — اختر مساراً مخصصاً", "Discord not found — choose a custom path"));
            path = _installs[0].ResourcesPath;
            return true;
        }
        catch (Exception ex) { Msg("✖ " + ex.Message); return false; }
    }

    bool ConfirmKill(string res)
    {
        try
        {
            var root = Path.GetDirectoryName(Path.GetDirectoryName(res));
            if (string.IsNullOrEmpty(root)) return true;
            var name = Path.GetFileName(root);
            if (string.IsNullOrEmpty(name)) return true;
            if (Process.GetProcessesByName(name).Length == 0) return true;
            return MessageBox.Show(this,
                T("Discord يعمل حالياً وسيتم إغلاقه.\nهل تريد المتابعة؟",
                  "Discord is running and will be closed.\nDo you want to continue?"),
                T("تنبيه", "Warning"),
                MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes;
        }
        catch { return true; }
    }

    // ── Button handlers ───────────────────────────────────────────────

    void OnInstall(object sender, EventArgs e)
    {
        string t; if (!TryGetTarget(out t) || !ConfirmKill(t)) return;
        RunAsync(() => Logic.Install(t, s => Msg(s), v => Prog(v)));
    }

    void OnRepair(object sender, EventArgs e)
    {
        string t; if (!TryGetTarget(out t) || !ConfirmKill(t)) return;
        RunAsync(() => Logic.Install(t, s => Msg(s), v => Prog(v)));
    }

    void OnRemove(object sender, EventArgs e)
    {
        string t; if (!TryGetTarget(out t)) return;
        if (MessageBox.Show(this,
                T("هل تريد إزالة Esharq بالكامل؟", "Are you sure you want to completely uninstall Esharq?"),
                T("تأكيد", "Confirm"),
                MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
        if (!ConfirmKill(t)) return;
        RunAsync(() => Logic.Uninstall(t, s => Msg(s), v => Prog(v)));
    }

    void OnOpenAsar(object sender, EventArgs e)
    {
        string t; if (!TryGetTarget(out t) || !ConfirmKill(t)) return;
        RunAsync(() => Logic.InstallOpenAsar(t, s => Msg(s), v => Prog(v)));
    }

    // ── Async runner ──────────────────────────────────────────────────

    void RunAsync(Action op)
    {
        SetBusy(true); Prog(0);
        var t = new Thread(() =>
        {
            try { op(); }
            catch (Exception ex) { Msg(T("✖ خطأ: ", "✖ Error: ") + ex.Message); Prog(0); }
            finally
            {
                if (!IsDisposed) SafeInvoke(() =>
                {
                    SetBusy(false);
                    UpdatePrimaryButton();
                    bool inst = Logic.IsInstalled;
                    if (_lblFileStatus != null)
                    {
                        _lblFileStatus.Text      = inst ? T("✔ تم التحقق من الملف بنجاح", "✔ File verified successfully")
                                                        : T("ℹ لم يُثبَّت بعد", "ℹ Not installed yet");
                        _lblFileStatus.ForeColor = inst ? SUCCESS : TEXT_MUTED;
                    }
                });
            }
        });
        t.IsBackground = true;
        t.Start();
    }

    void Msg(string text)  { SafeInvoke(() => { if (_lblStatus != null) _lblStatus.Text = text; }); }

    void Prog(int v)
    {
        SafeInvoke(() =>
        {
            int w = (int)(730 * Math.Max(0, Math.Min(100, v)) / 100.0);
            if (_progFill != null) _progFill.Width = w;
        });
    }

    void SetBusy(bool on)
    {
        foreach (var b in new[] { _btnInstall, _btnRepair, _btnRemove, _btnOpenAsar })
            if (b != null) b.Enabled = !on;
        UseWaitCursor = on;
    }

    void OnDrag(object sender, MouseEventArgs e)
    {
        if (e.Button == MouseButtons.Left) { ReleaseCapture(); SendMessage(Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0); }
    }

    void SafeInvoke(Action a)
    {
        if (IsDisposed) return;
        try { if (InvokeRequired) Invoke(a); else a(); }
        catch { }
    }

    static string ShortenPath(string path)
    {
        try
        {
            var roaming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            if (!string.IsNullOrEmpty(roaming) &&
                path.StartsWith(roaming, StringComparison.OrdinalIgnoreCase))
                return "Roaming" + path.Substring(roaming.Length);
        }
        catch { }
        return path.Length > 70 ? "..." + path.Substring(path.Length - 67) : path;
    }

    static void TryOpen(string url)
    {
        if (string.IsNullOrEmpty(url)) return;
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch { }
    }

    // ── Control factories ─────────────────────────────────────────────
    // Panel/Button: always explicit solid BackColor — NEVER Color.Transparent
    // Label/LinkLabel: Color.Transparent is safe (they use parent BackColor via WM_ERASEBKGND)

    static Panel MakePanel(int x, int y, int w, int h, Color bg)
    {
        return new Panel { Location = new Point(x, y), Size = new Size(w, h), BackColor = bg };
    }

    static Label MakeLabel(string text, int x, int y, Color col,
        float fs = 10f, FontStyle st = FontStyle.Regular,
        Control parent = null, int w = 0, int h = 0,
        ContentAlignment align = ContentAlignment.TopLeft)
    {
        var l = new Label
        {
            Text      = text,
            Location  = new Point(x, y),
            ForeColor = col,
            BackColor = Color.Transparent,
            Font      = new Font("Segoe UI", fs, st),
            TextAlign = align,
        };
        if (w > 0 && h > 0) l.Size = new Size(w, h);
        else l.AutoSize = true;
        if (parent != null) parent.Controls.Add(l);
        return l;
    }

    static Button MakeFlatBtn(string text, int x, int y, int w, int h, Color bg, Color fg)
    {
        var b = new Button
        {
            Text      = text,
            Location  = new Point(x, y),
            Size      = new Size(w, h),
            BackColor = bg,
            ForeColor = fg,
            FlatStyle = FlatStyle.Flat,
            Font      = new Font("Segoe UI", 10f),
            Cursor    = Cursors.Hand,
            UseVisualStyleBackColor = false,
        };
        b.FlatAppearance.BorderSize             = 0;
        b.FlatAppearance.MouseOverBackColor     = ControlPaint.Light(bg, 0.12f);
        return b;
    }

    static LinkLabel MakeLink(string text, int x, int y, float fs, Control parent, string url)
    {
        var l = new LinkLabel
        {
            Text            = text,
            Location        = new Point(x, y),
            AutoSize        = true,
            ForeColor       = Color.FromArgb(114, 118, 125),
            BackColor       = Color.Transparent,
            Font            = new Font("Segoe UI", fs),
            LinkColor       = Color.FromArgb(114, 118, 125),
            ActiveLinkColor = Color.FromArgb(109, 68, 246),
            LinkBehavior    = LinkBehavior.HoverUnderline,
        };
        if (!string.IsNullOrEmpty(url))
            l.LinkClicked += (s, e) => TryOpen(url);
        if (parent != null) parent.Controls.Add(l);
        return l;
    }
}

// ─────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────

static class Program
{
    [DllImport("user32.dll")]
    static extern bool SetProcessDPIAware();

    [STAThread]
    static void Main()
    {
        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (s, ex) =>
        {
            try
            {
                File.WriteAllText(
                    Path.Combine(Path.GetTempPath(), "esharq_crash.txt"),
                    string.Format("[{0}] {1}: {2}",
                        DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                        ex.Exception.GetType().Name,
                        ex.Exception.Message));
            }
            catch { }
            MessageBox.Show("خطأ:\n" + ex.Exception.Message,
                "Esharq", MessageBoxButtons.OK, MessageBoxIcon.Error);
        };

        try { SetProcessDPIAware(); } catch { }

        Logic.InitNetwork();
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new InstallerForm());
    }
}
