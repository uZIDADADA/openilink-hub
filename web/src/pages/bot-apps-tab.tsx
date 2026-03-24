import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { api } from "../lib/api";
import { Blocks, Plus, ExternalLink, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

export function BotAppsTab({ botId }: { botId: string }) {
  const [installations, setInstallations] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [showInstall, setShowInstall] = useState(false);
  const [installing, setInstalling] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function load() {
    try {
      setInstallations((await api.listBotApps(botId)) || []);
    } catch {}
  }

  async function loadApps() {
    try {
      setApps((await api.listApps()) || []);
    } catch {}
  }

  useEffect(() => {
    load();
  }, [botId]);

  async function handleInstall(appId: string, slug: string) {
    setInstalling(appId);
    setError("");
    try {
      await api.installApp(appId, { bot_id: botId, handle: slug });
      setShowInstall(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
    setInstalling("");
  }

  async function handleUninstall(appId: string, instId: string) {
    if (!confirm("确定卸载此 App？")) return;
    try {
      await api.deleteInstallation(appId, instId);
      load();
    } catch {}
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">已安装的 App</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowInstall(!showInstall);
            if (!showInstall) loadApps();
          }}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> 安装 App
        </Button>
      </div>

      {installations.length === 0 && !showInstall && (
        <div className="text-center py-12 space-y-3">
          <Blocks className="w-10 h-10 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">暂无安装的 App</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowInstall(true);
              loadApps();
            }}
          >
            浏览 App 市场
          </Button>
        </div>
      )}

      {/* Installed apps */}
      <div className="space-y-2">
        {installations.map((inst) => (
          <Card key={inst.id}>
            <CardContent className="py-3 space-y-3">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(expanded === inst.id ? null : inst.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {inst.app_icon && <span className="text-lg">{inst.app_icon}</span>}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{inst.app_name}</span>
                      {inst.handle && (
                        <Badge variant="outline" className="text-xs font-mono">
                          @{inst.handle}
                        </Badge>
                      )}
                      {inst.enabled ? (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-0.5" /> 启用
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <XCircle className="w-3 h-3 mr-0.5" /> 停用
                        </Badge>
                      )}
                      {inst.url_verified && (
                        <Badge variant="outline" className="text-xs text-primary">
                          URL 已验证
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {inst.request_url || "未配置 Request URL"}
                    </p>
                  </div>
                </div>
                {expanded === inst.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </div>

              {expanded === inst.id && (
                <InstallationConfig inst={inst} appId={inst.app_id} onUpdate={load} onUninstall={() => handleUninstall(inst.app_id, inst.id)} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Install picker */}
      {showInstall && (
        <Card>
          <CardContent className="space-y-3 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">选择 App</p>
              <Button variant="ghost" size="sm" onClick={() => setShowInstall(false)}>
                关闭
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {apps.length === 0 && (
              <div className="text-center py-6 space-y-2">
                <p className="text-xs text-muted-foreground">没有可用的 App</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/dashboard/apps")}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> 去创建 App
                </Button>
              </div>
            )}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {apps.map((app) => {
                const installCount = installations.filter((i) => i.app_id === app.id).length;
                return (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-2 rounded-lg border bg-background"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {app.icon && <span>{app.icon}</span>}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">{app.name}</span>
                          <span className="text-xs text-muted-foreground">{app.slug}</span>
                          {installCount > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              已安装 {installCount} 次
                            </Badge>
                          )}
                        </div>
                        {app.description && (
                          <p className="text-xs text-muted-foreground truncate">{app.description}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={installing === app.id}
                      onClick={() => handleInstall(app.id, app.slug)}
                      className="shrink-0"
                    >
                      {installing === app.id ? "..." : "安装"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InstallationConfig({
  inst,
  appId,
  onUpdate,
  onUninstall,
}: {
  inst: any;
  appId: string;
  onUpdate: () => void;
  onUninstall: () => void;
}) {
  const [handle, setHandle] = useState(inst.handle || "");
  const [requestUrl, setRequestUrl] = useState(inst.request_url || "");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      await api.updateInstallation(appId, inst.id, {
        handle: handle.trim(),
        request_url: requestUrl.trim(),
        enabled: inst.enabled,
      });
      setMsg("已保存");
      onUpdate();
    } catch (err: any) {
      setMsg(err.message);
    }
    setSaving(false);
  }

  async function handleVerify() {
    setVerifying(true);
    setMsg("");
    try {
      await api.verifyUrl(appId, inst.id);
      setMsg("URL 验证成功");
      onUpdate();
    } catch (err: any) {
      setMsg("验证失败: " + err.message);
    }
    setVerifying(false);
  }

  async function handleToggle() {
    try {
      await api.updateInstallation(appId, inst.id, {
        handle: inst.handle,
        request_url: inst.request_url,
        enabled: !inst.enabled,
      });
      onUpdate();
    } catch {}
  }

  return (
    <div className="border-t pt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Handle（@提及）</label>
          <Input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="留空则不响应 @提及"
            className="h-8 text-xs font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Request URL</label>
          <div className="flex gap-1">
            <Input
              value={requestUrl}
              onChange={(e) => setRequestUrl(e.target.value)}
              placeholder="https://your-app.example.com/webhook"
              className="h-8 text-xs font-mono"
            />
            <Button size="sm" variant="outline" onClick={handleVerify} disabled={verifying || !requestUrl.trim()}>
              {verifying ? "..." : "验证"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-xs ${msg.includes("失败") ? "text-destructive" : "text-primary"}`}>
              {msg}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/apps/${appId}`)}>
            App 详情
          </Button>
          <Button size="sm" variant="outline" onClick={handleToggle}>
            {inst.enabled ? "停用" : "启用"}
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onUninstall}>
            卸载
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
