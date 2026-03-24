import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Plus, Blocks, X, Download } from "lucide-react";
import { api } from "../lib/api";

function AppIcon({ icon, iconUrl, size = "w-8 h-8" }: { icon?: string; iconUrl?: string; size?: string }) {
  if (iconUrl) return <img src={iconUrl} alt="" className={`${size} rounded-lg object-cover`} />;
  if (icon) return <div className={`${size} rounded-lg bg-secondary flex items-center justify-center text-lg`}>{icon}</div>;
  return <div className={`${size} rounded-lg bg-secondary flex items-center justify-center`}><Blocks className="w-4 h-4 text-muted-foreground" /></div>;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

export function AppsPage() {
  const [tab, setTab] = useState<"marketplace" | "my">("marketplace");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">App 管理</h1>
          <p className="text-xs text-muted-foreground mt-0.5">发现和安装 App，或创建你自己的 App</p>
        </div>
      </div>

      <div className="flex border rounded-lg overflow-hidden w-fit">
        <button
          className={`px-3 py-1 text-xs cursor-pointer ${tab === "marketplace" ? "bg-secondary" : "text-muted-foreground"}`}
          onClick={() => setTab("marketplace")}
        >
          市场
        </button>
        <button
          className={`px-3 py-1 text-xs cursor-pointer ${tab === "my" ? "bg-secondary" : "text-muted-foreground"}`}
          onClick={() => setTab("my")}
        >
          我的
        </button>
      </div>

      {tab === "marketplace" && <MarketplaceTab />}
      {tab === "my" && <MyAppsTab />}
    </div>
  );
}

// ==================== Marketplace ====================

function MarketplaceTab() {
  const [apps, setApps] = useState<any[]>([]);
  const [installApp, setInstallApp] = useState<any>(null);

  useEffect(() => {
    api
      .listApps({ listed: true })
      .then((list) => setApps(list || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      {apps.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">暂无上架的 App</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {apps.map((app) => (
          <Card key={app.id} className="space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <AppIcon icon={app.icon} iconUrl={app.icon_url} size="w-10 h-10" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">{app.name}</p>
                  {app.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {app.description}
                    </p>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setInstallApp(app)}>
                <Download className="w-3.5 h-3.5 mr-1" /> 安装
              </Button>
            </div>
            {app.tools?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {app.tools.map((tool: any) => (
                  <Badge key={tool.name} variant="outline" className="text-xs font-mono">
                    {tool.command ? `/${tool.command}` : tool.name}
                  </Badge>
                ))}
              </div>
            )}
            {app.scopes?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {app.scopes.map((s: string) => (
                  <span
                    key={s}
                    className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {installApp && <InstallModal app={installApp} onClose={() => setInstallApp(null)} />}
    </div>
  );
}

// ==================== Install Modal ====================

function InstallModal({ app, onClose }: { app: any; onClose: () => void }) {
  const [bots, setBots] = useState<any[]>([]);
  const [botId, setBotId] = useState("");
  const [handle, setHandle] = useState(app.slug || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const tools = (app.tools || []) as any[];
  const events = (app.events || []) as string[];
  const scopes = (app.scopes || []) as string[];

  useEffect(() => {
    api.listBots().then((list) => {
      const items = list || [];
      setBots(items);
      if (items.length > 0) setBotId(items[0].id);
    }).catch(() => {});
  }, []);

  async function handleInstall() {
    if (!botId) { setError("请选择一个 Bot"); return; }
    setSaving(true); setError("");
    try {
      await api.installApp(app.id, { bot_id: botId, handle: handle.trim() || undefined });
      setSuccess(true);
    } catch (err: any) { setError(err.message); }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background border rounded-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {success ? (
          <div className="p-4 space-y-3">
            <p className="text-sm font-medium">安装成功！</p>
            <p className="text-xs text-muted-foreground">
              在 Bot 的 Apps 页面管理此安装。
            </p>
            <div className="flex justify-end">
              <Button size="sm" onClick={onClose}>确认</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <AppIcon icon={app.icon} iconUrl={app.icon_url} />
                <div>
                  <span className="font-semibold text-sm">{app.name}</span>
                  {app.description && <p className="text-xs text-muted-foreground">{app.description}</p>}
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Tools */}
              {tools.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1">工具 / 命令</p>
                  <div className="space-y-1">
                    {tools.map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                          {t.command ? `/${t.command}` : t.name}
                        </Badge>
                        <span className="text-muted-foreground truncate">{t.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events */}
              {events.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1">事件订阅</p>
                  <div className="flex flex-wrap gap-1">
                    {events.map((e) => <Badge key={e} variant="secondary" className="text-[10px] font-mono">{e}</Badge>)}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">此 App 将接收所有匹配的消息事件</p>
                </div>
              )}

              {/* Scopes */}
              {scopes.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1">请求的权限</p>
                  <div className="space-y-0.5">
                    {scopes.map((s) => (
                      <div key={s} className="text-xs flex items-center gap-1">
                        <span className="font-mono">{s}</span>
                        <span className="text-muted-foreground">
                          {s === "messages.send" && "— 可通过 Bot 发送消息"}
                          {s === "contacts.read" && "— 可读取联系人列表"}
                          {s === "bot.read" && "— 可读取 Bot 信息"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bot + Handle */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">选择 Bot</label>
                <select value={botId} onChange={(e) => setBotId(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-transparent px-3 text-xs">
                  {bots.length === 0 && <option value="">无可用 Bot</option>}
                  {bots.map((b) => <option key={b.id} value={b.id}>{b.name || b.id}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Handle（用于 @提及，可清空）</label>
                <Input placeholder="留空则只能通过 /command 触发" value={handle}
                  onChange={(e) => setHandle(e.target.value)} className="h-8 text-xs font-mono" />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
              <Button size="sm" onClick={handleInstall} disabled={saving}>{saving ? "..." : "确认安装"}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ==================== My Apps ====================

function MyAppsTab() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "", icon: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const list = await api.listApps();
      setApps(list || []);
    } catch {}
  }

  useEffect(() => {
    load();
  }, []);

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: slugify(name) }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("名称不能为空");
      return;
    }
    if (!form.slug.trim()) {
      setError("Slug 不能为空");
      return;
    }
    setSaving(true);
    try {
      await api.createApp(form);
      setForm({ name: "", slug: "", description: "", icon: "" });
      setCreating(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!creating && (
          <Button onClick={() => setCreating(true)} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-1" /> 创建 App
          </Button>
        )}
      </div>

      {creating && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">创建新 App</h3>
            <button
              onClick={() => {
                setCreating(false);
                setError("");
              }}
              className="cursor-pointer"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-2">
            <Input
              placeholder="App 名称"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Slug（URL 标识符）"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className="h-8 text-xs font-mono"
            />
            <Input
              placeholder="描述（可选）"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="h-8 text-xs"
            />
            <Input
              placeholder="图标 URL（可选）"
              value={form.icon}
              onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
              className="h-8 text-xs"
            />
            <div className="flex items-center justify-between">
              <div>{error && <span className="text-xs text-destructive">{error}</span>}</div>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "..." : "创建"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {apps.map((app) => (
        <Card
          key={app.id}
          className="flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate(`/dashboard/apps/${app.id}`)}
        >
          <div className="flex items-center gap-3">
            <AppIcon icon={app.icon} iconUrl={app.icon_url} />
            <div>
              <p className="font-medium text-sm">{app.name}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{app.slug}</p>
              {app.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {app.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {app.tools?.length > 0 && (
              <span className="text-xs text-muted-foreground">{app.tools.length} 个工具</span>
            )}
            <Badge variant={app.status === "active" ? "default" : "outline"}>
              {app.status === "active" ? "启用" : app.status || "草稿"}
            </Badge>
          </div>
        </Card>
      ))}

      {apps.length === 0 && !creating && (
        <p className="text-center text-sm text-muted-foreground py-8">
          点击上方按钮创建你的第一个 App
        </p>
      )}
    </div>
  );
}
