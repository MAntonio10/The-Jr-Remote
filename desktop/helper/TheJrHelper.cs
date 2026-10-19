// Servicio de Windows (SYSTEM) que deja controlar lo que The Jr no alcanza: avisos de UAC y pantalla de bloqueo.
//
//   TheJrHelper.exe service "<ruta de The Jr.exe>"   servicio: mantiene un "agent" en la sesión de la consola
//   TheJrHelper.exe agent   "<ruta de The Jr.exe>"   corre como SYSTEM dentro de la sesión del usuario: captura
//                                                    el escritorio que recibe la entrada (incluido el protegido)
//                                                    e inyecta mouse y teclado en él
//
// Se compila con el csc.exe de .NET Framework 4 que trae Windows (C# 5): npm run build:helper
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

static class Native
{
    public const uint GENERIC_ALL = 0x10000000;
    [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetThreadDesktop(IntPtr desk);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool CloseDesktop(IntPtr desk);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool GetUserObjectInformation(IntPtr obj, int index, StringBuilder info, int length, out int needed);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr wnd);
    [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr wnd, IntPtr dc);
    [DllImport("user32.dll")] public static extern bool GetCursorInfo(ref CURSORINFO info);
    [DllImport("user32.dll")] public static extern bool DrawIconEx(IntPtr dc, int x, int y, IntPtr icon, int w, int h, int step, IntPtr brush, int flags);
    [DllImport("user32.dll", SetLastError = true)] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr wnd, out int pid);
    [DllImport("user32.dll")] public static extern IntPtr GetKeyboardLayout(int threadId);
    [DllImport("user32.dll")] public static extern short VkKeyScanEx(char ch, IntPtr hkl);
    [DllImport("gdi32.dll")] public static extern IntPtr CreateCompatibleDC(IntPtr dc);
    [DllImport("gdi32.dll")] public static extern IntPtr CreateCompatibleBitmap(IntPtr dc, int w, int h);
    [DllImport("gdi32.dll")] public static extern IntPtr SelectObject(IntPtr dc, IntPtr obj);
    [DllImport("gdi32.dll")] public static extern bool BitBlt(IntPtr dst, int x, int y, int w, int h, IntPtr src, int sx, int sy, int rop);
    [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr obj);
    [DllImport("gdi32.dll")] public static extern bool DeleteDC(IntPtr dc);
    [DllImport("kernel32.dll")] public static extern uint WTSGetActiveConsoleSessionId();
    [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll", SetLastError = true)] public static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool QueryFullProcessImageName(IntPtr proc, int flags, StringBuilder name, ref int size);
    [DllImport("kernel32.dll")] public static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", SetLastError = true)] public static extern bool GetNamedPipeClientProcessId(IntPtr pipe, out int pid);
    [DllImport("advapi32.dll", SetLastError = true)] public static extern bool OpenProcessToken(IntPtr proc, uint access, out IntPtr token);
    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern bool DuplicateTokenEx(IntPtr token, uint access, IntPtr attrs, int level, int type, out IntPtr dup);
    [DllImport("advapi32.dll", SetLastError = true)] public static extern bool SetTokenInformation(IntPtr token, int cls, ref uint info, int len);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CreateProcessAsUser(IntPtr token, string app, string cmd, IntPtr pa, IntPtr ta, bool inherit,
        uint flags, IntPtr env, string dir, ref STARTUPINFO si, out PROCESS_INFORMATION pi);

    [StructLayout(LayoutKind.Sequential)] public struct CURSORINFO { public int size, flags; public IntPtr cursor; public int x, y; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct STARTUPINFO
    {
        public int cb; public string reserved, desktop, title; public int x, y, xs, ys, xc, yc, fill, flags;
        public short show, res2; public IntPtr res2p, stdin, stdout, stderr;
    }
    [StructLayout(LayoutKind.Sequential)] public struct PROCESS_INFORMATION { public IntPtr process, thread; public int pid, tid; }
    [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx, dy, data, flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort vk, scan; public int flags, time; public IntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
    [StructLayout(LayoutKind.Sequential)] public struct INPUT { public int type; public INPUTUNION u; }
}

// Cada hilo que captura o inyecta se pega primero al escritorio que recibe la entrada (Default, Winlogon…)
static class Desk
{
    [ThreadStatic] static IntPtr current;

    public static string Name()
    {
        IntPtr d = Native.OpenInputDesktop(0, false, Native.GENERIC_ALL);
        if (d == IntPtr.Zero) return "";
        try
        {
            StringBuilder sb = new StringBuilder(256);
            int needed;
            return Native.GetUserObjectInformation(d, 2, sb, sb.Capacity * 2, out needed) ? sb.ToString() : "";
        }
        finally { Native.CloseDesktop(d); }
    }

    public static bool Attach()
    {
        IntPtr d = Native.OpenInputDesktop(0, false, Native.GENERIC_ALL);
        if (d == IntPtr.Zero) return false;
        if (!Native.SetThreadDesktop(d)) { Native.CloseDesktop(d); return false; }
        if (current != IntPtr.Zero) Native.CloseDesktop(current);
        current = d;
        return true;
    }
}

static class Capture
{
    static readonly ImageCodecInfo Jpeg = Array.Find(ImageCodecInfo.GetImageEncoders(), delegate(ImageCodecInfo c) { return c.MimeType == "image/jpeg"; });

    public static byte[] Frame()
    {
        if (!Desk.Attach()) return null;
        int w = Native.GetSystemMetrics(0), h = Native.GetSystemMetrics(1);
        IntPtr screen = Native.GetDC(IntPtr.Zero), mem = Native.CreateCompatibleDC(screen);
        IntPtr bmp = Native.CreateCompatibleBitmap(screen, w, h), old = Native.SelectObject(mem, bmp);
        try
        {
            if (!Native.BitBlt(mem, 0, 0, w, h, screen, 0, 0, 0x00CC0020 | 0x40000000)) return null;
            Native.CURSORINFO ci = new Native.CURSORINFO();
            ci.size = Marshal.SizeOf(typeof(Native.CURSORINFO));
            if (Native.GetCursorInfo(ref ci) && (ci.flags & 1) != 0) Native.DrawIconEx(mem, ci.x, ci.y, ci.cursor, 0, 0, 0, IntPtr.Zero, 3);
            using (Bitmap img = Image.FromHbitmap(bmp))
            using (MemoryStream ms = new MemoryStream())
            using (EncoderParameters p = new EncoderParameters(1))
            {
                p.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 50L); // más liviano = decodifica más rápido en el teléfono
                img.Save(ms, Jpeg, p);
                return ms.ToArray();
            }
        }
        finally
        {
            Native.SelectObject(mem, old);
            Native.DeleteObject(bmp);
            Native.DeleteDC(mem);
            Native.ReleaseDC(IntPtr.Zero, screen);
        }
    }
}

// Mismos mensajes que input.js: move/down/up/click/wheel/key/combo/text/release (x,y normalizados 0..1)
static class Inject
{
    static readonly HashSet<ushort> held = new HashSet<ushort>();
    static readonly Dictionary<string, ushort> Vk = BuildKeys();

    static Dictionary<string, ushort> BuildKeys()
    {
        Dictionary<string, ushort> k = new Dictionary<string, ushort>();
        for (char c = 'A'; c <= 'Z'; c++) k["Key" + c] = (ushort)c;
        for (int i = 0; i <= 9; i++) { k["Digit" + i] = (ushort)(0x30 + i); k["Numpad" + i] = (ushort)(0x60 + i); }
        for (int i = 1; i <= 12; i++) k["F" + i] = (ushort)(0x6F + i);
        string[] names = { "Backspace", "Tab", "Enter", "Escape", "Space", "PageUp", "PageDown", "End", "Home", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Insert", "Delete" };
        ushort[] codes = { 0x08, 0x09, 0x0D, 0x1B, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E };
        for (int i = 0; i < names.Length; i++) k[names[i]] = codes[i];
        k["NumpadEnter"] = 0x0D; k["ShiftLeft"] = 0xA0; k["ShiftRight"] = 0xA1; k["ControlLeft"] = 0xA2; k["ControlRight"] = 0xA3;
        k["AltLeft"] = 0xA4; k["AltRight"] = 0xA5; k["MetaLeft"] = 0x5B; k["MetaRight"] = 0x5C; k["ContextMenu"] = 0x5D;
        k["NumpadAdd"] = 0x6B; k["NumpadSubtract"] = 0x6D; k["NumpadMultiply"] = 0x6A; k["NumpadDivide"] = 0x6F; k["NumpadDecimal"] = 0x6E;
        k["Minus"] = 0xBD; k["Equal"] = 0xBB; k["BracketLeft"] = 0xDB; k["BracketRight"] = 0xDD; k["Backslash"] = 0xDC;
        k["Semicolon"] = 0xBA; k["Quote"] = 0xDE; k["Comma"] = 0xBC; k["Period"] = 0xBE; k["Slash"] = 0xBF; k["Backquote"] = 0xC0;
        return k;
    }

    static void Send(Native.INPUT i)
    {
        Native.SendInput(1, new Native.INPUT[] { i }, Marshal.SizeOf(typeof(Native.INPUT)));
    }

    static void Mouse(int flags, int dx, int dy, int data)
    {
        Native.INPUT i = new Native.INPUT();
        i.type = 0;
        i.u.mi.flags = flags; i.u.mi.dx = dx; i.u.mi.dy = dy; i.u.mi.data = data;
        Send(i);
    }

    // Flechas, Inicio/Fin, Insertar/Suprimir, Win, ctrl/alt derechos: sin esta marca Windows los toma como del teclado numérico
    static bool Extended(ushort vk)
    {
        return (vk >= 0x21 && vk <= 0x28) || vk == 0x2D || vk == 0x2E || vk == 0x5B || vk == 0x5C || vk == 0x5D || vk == 0xA3 || vk == 0xA5 || vk == 0x6F;
    }

    static void Key(ushort vk, bool down, int extra)
    {
        Native.INPUT i = new Native.INPUT();
        i.type = 1;
        i.u.ki.vk = vk;
        i.u.ki.flags = (down ? 0 : 2) | extra | (Extended(vk) ? 1 : 0);
        if (down) held.Add(vk); else held.Remove(vk);
        Send(i);
    }

    static void Unicode(char c, bool down)
    {
        Native.INPUT i = new Native.INPUT();
        i.type = 1;
        i.u.ki.scan = c;
        i.u.ki.flags = 4 | (down ? 0 : 2);
        Send(i);
    }

    // Escribe un carácter como tecla real (VK + modificadores). Las consolas (PowerShell, cmd) ignoran el Unicode puro.
    // Si el teclado del equipo no tiene esa tecla, cae a Unicode (sirve en apps normales).
    static void TypeChar(char c)
    {
        int pid;
        IntPtr hkl = Native.GetKeyboardLayout(Native.GetWindowThreadProcessId(Native.GetForegroundWindow(), out pid));
        short vks = Native.VkKeyScanEx(c, hkl);
        if (vks == -1) { Unicode(c, true); Unicode(c, false); return; }
        ushort vk = (ushort)(vks & 0xFF);
        int mod = (vks >> 8) & 0xFF; // 1 Shift, 2 Ctrl, 4 Alt
        if ((mod & 2) != 0) Key(0xA2, true, 0);
        if ((mod & 4) != 0) Key(0xA4, true, 0);
        if ((mod & 1) != 0) Key(0xA0, true, 0);
        Key(vk, true, 0); Key(vk, false, 0);
        if ((mod & 1) != 0) Key(0xA0, false, 0);
        if ((mod & 4) != 0) Key(0xA4, false, 0);
        if ((mod & 2) != 0) Key(0xA2, false, 0);
    }

    static double Num(object o) { try { return Convert.ToDouble(o); } catch { return 0; } }
    static int Norm(object o) { return (int)Math.Round(Math.Min(Math.Max(Num(o), 0), 1) * 65535); }

    // Botón 0 izquierdo, 1 central, 2 derecho: banderas de bajar y subir
    static int Btn(Dictionary<string, object> m, bool down)
    {
        int b = m.ContainsKey("b") ? (int)Num(m["b"]) : 0;
        if (b == 1) return down ? 0x20 : 0x40;
        if (b == 2) return down ? 0x08 : 0x10;
        return down ? 0x02 : 0x04;
    }

    public static void Run(Dictionary<string, object> m)
    {
        object t;
        if (!m.TryGetValue("t", out t)) return;
        if (!Desk.Attach()) return;
        if ((string)t == "release")
        {
            foreach (ushort vk in new List<ushort>(held)) Key(vk, false, 0);
            Mouse(0x04 | 0x10 | 0x40, 0, 0, 0);
            return;
        }
        if (m.ContainsKey("x") && m.ContainsKey("y")) Mouse(0x8001, Norm(m["x"]), Norm(m["y"]), 0);
        switch ((string)t)
        {
            case "down": Mouse(Btn(m, true), 0, 0, 0); break;
            case "up": Mouse(Btn(m, false), 0, 0, 0); break;
            case "click": Mouse(Btn(m, true), 0, 0, 0); Mouse(Btn(m, false), 0, 0, 0); break;
            case "wheel": Mouse(0x0800, 0, 0, -(int)Math.Max(-2400, Math.Min(2400, Num(m.ContainsKey("dy") ? m["dy"] : 0)))); break;
            case "key":
                ushort vk;
                if (m.ContainsKey("code") && Vk.TryGetValue(Convert.ToString(m["code"]), out vk)) Key(vk, m.ContainsKey("down") && (bool)m["down"], 0);
                break;
            case "combo":
                List<ushort> keys = new List<ushort>();
                object codes;
                if (m.TryGetValue("codes", out codes) && codes is System.Collections.IEnumerable)
                    foreach (object c in (System.Collections.IEnumerable)codes)
                    {
                        ushort v;
                        if (Vk.TryGetValue(Convert.ToString(c), out v)) keys.Add(v);
                    }
                foreach (ushort v in keys) Key(v, true, 0);
                keys.Reverse();
                foreach (ushort v in keys) Key(v, false, 0);
                break;
            case "text":
                string s = m.ContainsKey("s") ? Convert.ToString(m["s"]) : "";
                if (s.Length > 500) s = s.Substring(0, 500);
                // Shift o AltGr sostenidos cambiarían el carácter: se sueltan mientras se teclea y se vuelven a presionar
                List<ushort> mods = new List<ushort>();
                foreach (ushort h in held) if (h == 0x10 || h == 0x11 || h == 0x12 || (h >= 0xA0 && h <= 0xA5)) mods.Add(h);
                foreach (ushort h in mods) Key(h, false, 0);
                foreach (char c in s) TypeChar(c);
                foreach (ushort h in mods) Key(h, true, 0);
                break;
        }
    }
}

// Protocolo con The Jr.exe por la tubería: [tipo:1][largo:4 LE][datos]. Tipo 0 = JSON, 1 = JPEG (solo del agent al cliente).
class Agent
{
    const string PipeName = "TheJrHelper";
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    readonly string allowed;
    Stream pipe;
    readonly object writeLock = new object();
    volatile bool frames;

    public Agent(string allowedExe) { allowed = allowedExe; }

    public void Loop()
    {
        Native.SetProcessDPIAware();
        PipeSecurity sec = new PipeSecurity();
        sec.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.AuthenticatedUserSid, null), PipeAccessRights.ReadWrite, AccessControlType.Allow));
        sec.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null), PipeAccessRights.FullControl, AccessControlType.Allow));
        new Thread(Watch) { IsBackground = true }.Start();
        new Thread(Pump) { IsBackground = true }.Start();
        while (true)
        {
            // Asynchronous: lectura y escritura a la vez. Síncrona, la escritura de cuadros se bloqueaba tras la lectura de entrada pendiente hasta que el usuario movía algo.
            using (NamedPipeServerStream server = new NamedPipeServerStream(PipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 65536, 65536, sec))
            {
                try
                {
                    server.WaitForConnection();
                    if (!ClientAllowed(server)) continue;
                    pipe = server;
                    Serve(server);
                }
                catch (IOException) { }
                finally { pipe = null; frames = false; Release(); }
            }
        }
    }

    // Solo el The Jr.exe instalado puede dar órdenes: este proceso es SYSTEM y puede pulsar "Sí" en un UAC
    bool ClientAllowed(NamedPipeServerStream server)
    {
        int pid;
        if (!Native.GetNamedPipeClientProcessId(server.SafePipeHandle.DangerousGetHandle(), out pid)) return false;
        IntPtr proc = Native.OpenProcess(0x1000, false, pid);
        if (proc == IntPtr.Zero) return false;
        try
        {
            StringBuilder sb = new StringBuilder(1024);
            int size = sb.Capacity;
            return Native.QueryFullProcessImageName(proc, 0, sb, ref size) && string.Equals(sb.ToString(), allowed, StringComparison.OrdinalIgnoreCase);
        }
        finally { Native.CloseHandle(proc); }
    }

    void Serve(Stream s)
    {
        byte[] head = new byte[5];
        while (true)
        {
            if (!ReadFull(s, head, 5)) return;
            int len = BitConverter.ToInt32(head, 1);
            if (len < 0 || len > 1 << 20) return;
            byte[] body = new byte[len];
            if (!ReadFull(s, body, len)) return;
            if (head[0] != 0) continue;
            Dictionary<string, object> m;
            try { m = Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(body)); } catch { continue; }
            if (m == null) continue;
            object t;
            if (m.TryGetValue("t", out t) && (string)t == "frames") frames = m.ContainsKey("on") && (bool)m["on"];
            else try { Inject.Run(m); } catch (Exception e) { Console.Error.WriteLine("input: " + e.Message); }
        }
    }

    static bool ReadFull(Stream s, byte[] buf, int n)
    {
        int got = 0;
        while (got < n)
        {
            int r = s.Read(buf, got, n - got);
            if (r <= 0) return false;
            got += r;
        }
        return true;
    }

    void Write(byte type, byte[] data)
    {
        lock (writeLock)
        {
            Stream p = pipe;
            if (p == null) return;
            try
            {
                byte[] head = new byte[5];
                head[0] = type;
                BitConverter.GetBytes(data.Length).CopyTo(head, 1);
                p.Write(head, 0, 5);
                p.Write(data, 0, data.Length);
                p.Flush();
            }
            catch (IOException) { }
            catch (ObjectDisposedException) { }
        }
    }

    // Avisa a The Jr cada vez que cambia el escritorio con foco (Default, Winlogon…)
    void Watch()
    {
        string last = null;
        while (true)
        {
            string now = Desk.Name();
            if (pipe == null) last = null;
            else if (now != last && now != "")
            {
                last = now;
                Write(0, Encoding.UTF8.GetBytes(Json.Serialize(new Dictionary<string, object> { { "desktop", now } })));
            }
            Thread.Sleep(250);
        }
    }

    byte[] lastFrame;

    static bool SameBytes(byte[] a, byte[] b)
    {
        if (a == null || b == null || a.Length != b.Length) return false;
        for (int i = 0; i < a.Length; i++) if (a[i] != b[i]) return false;
        return true;
    }

    void Pump()
    {
        DateTime lastSent = DateTime.MinValue;
        while (true)
        {
            if (!frames) { lastFrame = null; Thread.Sleep(100); continue; }
            DateTime t0 = DateTime.UtcNow;
            try
            {
                byte[] f = Capture.Frame();
                // Envía si cambió, o al menos cada 400 ms aunque no cambie: así el UAC aparece y la pantalla
                // vuelve sola sin tener que mover el mouse. El doble búfer del otro lado evita el parpadeo.
                bool changed = !SameBytes(f, lastFrame);
                bool stale = (t0 - lastSent).TotalMilliseconds >= 400;
                if (f != null && (changed || stale)) { lastFrame = f; lastSent = t0; Write(1, f); }
            }
            catch (Exception e) { Console.Error.WriteLine("captura: " + e.Message); Thread.Sleep(500); }
            int wait = 80 - (int)(DateTime.UtcNow - t0).TotalMilliseconds;
            if (wait > 0) Thread.Sleep(wait);
        }
    }

    static void Release()
    {
        Dictionary<string, object> m = new Dictionary<string, object>();
        m["t"] = "release";
        try { Inject.Run(m); } catch { }
    }
}

class Svc : ServiceBase
{
    readonly string clientExe;
    Thread worker;
    volatile bool stop;
    Process agent;
    uint agentSession = uint.MaxValue;

    public Svc(string clientExe)
    {
        this.clientExe = clientExe;
        ServiceName = "TheJrHelper";
    }

    protected override void OnStart(string[] args)
    {
        worker = new Thread(Run) { IsBackground = true };
        worker.Start();
    }

    protected override void OnStop()
    {
        stop = true;
        Kill();
    }

    void Kill()
    {
        try { if (agent != null && !agent.HasExited) agent.Kill(); } catch { }
        agent = null;
    }

    // Mantiene un agent vivo en la sesión de la consola (cambia de usuario, cierra sesión, se cae…)
    void Run()
    {
        while (!stop)
        {
            uint session = Native.WTSGetActiveConsoleSessionId();
            bool alive = false;
            try { alive = agent != null && !agent.HasExited; } catch { }
            if (session != 0xFFFFFFFF && (!alive || session != agentSession))
            {
                Kill();
                try { agent = Spawn(session); agentSession = session; }
                catch (Exception e) { EventLog.WriteEntry("Application", "TheJrHelper: " + e.Message, EventLogEntryType.Warning); }
            }
            Thread.Sleep(2000);
        }
    }

    Process Spawn(uint session)
    {
        IntPtr token, dup;
        if (!Native.OpenProcessToken(Native.GetCurrentProcess(), 0xF01FF, out token)) throw new Win32Exception();
        if (!Native.DuplicateTokenEx(token, 0x2000000, IntPtr.Zero, 2, 1, out dup)) throw new Win32Exception();
        try
        {
            if (!Native.SetTokenInformation(dup, 12, ref session, 4)) throw new Win32Exception();
            Native.STARTUPINFO si = new Native.STARTUPINFO();
            si.cb = Marshal.SizeOf(typeof(Native.STARTUPINFO));
            si.desktop = "winsta0\\default";
            Native.PROCESS_INFORMATION pi;
            string cmd = "\"" + Process.GetCurrentProcess().MainModule.FileName + "\" agent \"" + clientExe + "\"";
            if (!Native.CreateProcessAsUser(dup, null, cmd, IntPtr.Zero, IntPtr.Zero, false, 0x08000000, IntPtr.Zero, null, ref si, out pi)) throw new Win32Exception();
            Native.CloseHandle(pi.thread);
            Native.CloseHandle(pi.process);
            return Process.GetProcessById(pi.pid);
        }
        finally { Native.CloseHandle(dup); Native.CloseHandle(token); }
    }
}

static class Program
{
    static void Main(string[] args)
    {
        string mode = args.Length > 0 ? args[0] : "";
        string client = args.Length > 1 ? args[1] : "";
        if (mode == "service") ServiceBase.Run(new Svc(client));
        else if (mode == "agent") new Agent(client).Loop();
        else Console.Error.WriteLine("uso: TheJrHelper.exe service|agent \"<ruta de The Jr.exe>\"");
    }
}
