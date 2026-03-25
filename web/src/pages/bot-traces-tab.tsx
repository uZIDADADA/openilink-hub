import { useEffect, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import {
  RefreshCw,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Activity,
  User,
  Clock,
  ExternalLink,
  Info,
  Layers,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TraceSpan {
  id: number;
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  name: string;
  kind: string;
  status_code: string;
  status_message: string;
  start_time: number;
  end_time: number;
  attributes: Record<string, any> | null;
  events: { name: string; timestamp: number; attributes?: Record<string, any> }[] | null;
  created_at: number;
}

const kindColors: Record<string, string> = {
  internal: "bg-slate-500",
  client: "bg-blue-500",
  server: "bg-green-500",
};

function StatusIcon({ code, size = "w-4 h-4" }: { code: string; size?: string }) {
  if (code === "ok") return <CheckCircle2 className={`${size} text-green-500 shrink-0`} />;
  if (code === "error") return <XCircle className={`${size} text-destructive shrink-0`} />;
  return <MinusCircle className={`${size} text-muted-foreground shrink-0`} />;
}

function durationMs(span: TraceSpan): number {
  return span.end_time > span.start_time ? span.end_time - span.start_time : 0;
}

function buildTree(spans: TraceSpan[]): Map<string, TraceSpan[]> {
  const children = new Map<string, TraceSpan[]>();
  for (const s of spans) {
    const parentKey = s.parent_span_id || "";
    if (!children.has(parentKey)) children.set(parentKey, []);
    children.get(parentKey)!.push(s);
  }
  return children;
}

function SpanNode({ span, depth, tree }: {
  span: TraceSpan;
  depth: number;
  tree: Map<string, TraceSpan[]>;
}) {
  const children = tree.get(span.span_id) || [];
  const dur = durationMs(span);
  const [expanded, setExpanded] = useState(depth < 2);

  return (
    <div className="space-y-1">
      <div 
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md transition-colors cursor-pointer group"
        style={{ marginLeft: `${depth * 16}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-4 flex items-center justify-center">
          {children.length > 0 && (
            expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
        <StatusIcon code={span.status_code} size="w-3.5 h-3.5" />
        <Badge variant="outline" className={`text-[9px] h-4 px-1 leading-none text-white ${kindColors[span.kind] || "bg-gray-400"}`}>
          {span.kind}
        </Badge>
        <span className="text-[11px] font-mono font-medium truncate flex-1">{span.name}</span>
        {dur > 0 && <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted group-hover:bg-background">{dur}ms</span>}
      </div>

      {expanded && (
        <div className="space-y-1">
          {span.attributes && Object.keys(span.attributes).length > 0 && (
            <div className="ml-10 text-[10px] space-y-0.5 opacity-70">
               {Object.entries(span.attributes).map(([k, v]) => (
                 <div key={k} className="flex gap-2">
                   <span className="text-blue-500 font-bold shrink-0">{k}:</span>
                   <span className="truncate">{String(v)}</span>
                 </div>
               ))}
            </div>
          )}
          {children.map((child) => (
            <SpanNode key={child.span_id} span={child} depth={depth + 1} tree={tree} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BotTracesTab({ botId }: { botId: string }) {
  const [rootSpans, setRootSpans] = useState<TraceSpan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceSpans, setTraceSpans] = useState<TraceSpan[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listTraces(botId, 100);
      setRootSpans(data || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [botId]);

  async function handleRowClick(traceId: string) {
    setSelectedTraceId(traceId);
    setTraceLoading(true);
    try {
      const spans = await api.getTrace(botId, traceId);
      setTraceSpans(spans || []);
    } finally {
      setTraceLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">消息日志</h3>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8">
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> 刷新
        </Button>
      </div>

      <div className="rounded-xl border bg-card/50 overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead>发送者</TableHead>
              <TableHead className="hidden md:table-cell">核心事件</TableHead>
              <TableHead className="text-right">耗时</TableHead>
              <TableHead className="text-right">时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : rootSpans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                  暂无记录
                </TableCell>
              </TableRow>
            ) : (
              rootSpans.map((root) => {
                const dur = durationMs(root);
                const sender = root.attributes?.["message.sender"] || "System";
                const content = root.attributes?.["message.content"] || root.name;
                
                return (
                  <TableRow 
                    key={root.id} 
                    className="cursor-pointer group hover:bg-muted/50"
                    onClick={() => handleRowClick(root.trace_id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon code={root.status_code} size="w-3.5 h-3.5" />
                        <Badge variant="secondary" className="text-[9px] h-4 leading-none uppercase">
                          {root.attributes?.["message.type"] || "执行"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate">
                      {sender}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {content}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[10px] text-muted-foreground">
                      {dur > 0 ? `${dur}ms` : "<1ms"}
                    </TableCell>
                    <TableCell className="text-right text-[10px] text-muted-foreground">
                      {new Date(root.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedTraceId} onOpenChange={(open: boolean) => !open && setSelectedTraceId(null)}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-2 mb-1 text-primary">
              <Layers className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">追踪时间线</span>
            </div>
            <DialogTitle className="text-xl font-mono truncate">{selectedTraceId}</DialogTitle>
            <DialogDescription>
              点击节点展开查看详情。
            </DialogDescription>
          </DialogHeader>

          {traceLoading ? (
            <div className="space-y-4 py-8">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-[90%] ml-auto" />
              <Skeleton className="h-8 w-[85%] ml-auto" />
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1 pr-4">
              <div className="space-y-1">
                {(() => {
                  const tree = buildTree(traceSpans);
                  const roots = traceSpans.filter((s) => !s.parent_span_id);
                  return roots.map((s) => (
                    <SpanNode key={s.span_id} span={s} depth={0} tree={tree} />
                  ));
                })()}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
