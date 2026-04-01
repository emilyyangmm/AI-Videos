"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { toast } from "sonner";
import {
  Sparkles, Copy, RefreshCw, CheckCircle2, Loader2,
  ChevronRight, Target, Users, Zap, BookOpen, TrendingUp,
  MessageSquare, ArrowRight
} from "lucide-react";

// 薛老师8大爆款元素
const VIRAL_ELEMENTS = [
  { id: "cost", title: "成本维度", icon: "💰", desc: "花小钱办大事，性价比心理", hooks: ["花小钱装大杯", "省时省钱省力", "平替", "白嫖", "9.9元"] },
  { id: "crowd", title: "人群维度", icon: "👥", desc: "锁定特定群体，引发共情归属", hooks: ["宝妈", "程序员", "打工人", "小个子", "处女座"] },
  { id: "curiosity", title: "猎奇维度", icon: "🔍", desc: "反常识冷知识，打破认知惯性", hooks: ["反常识", "万万没想到", "揭秘", "黑科技", "据说"] },
  { id: "contrast", title: "反差维度", icon: "⚡", desc: "制造戏剧冲突，产生记忆点", hooks: ["身份错位", "居然", "竟然", "没想到"] },
  { id: "worst", title: "最差元素", icon: "👎", desc: "利用负面情绪，引发讨论吐槽", hooks: ["最丢脸", "避坑", "千万别买", "全网最低分"] },
  { id: "authority", title: "头牌效应", icon: "👑", desc: "借势名人权威，建立信任认知", hooks: ["明星同款", "大佬揭秘", "CCTV报道", "首富思维"] },
  { id: "nostalgia", title: "怀旧元素", icon: "📼", desc: "激活集体记忆，触发情感共鸣", hooks: ["童年回忆", "20年前", "老味道", "爷青回"] },
  { id: "hormone", title: "荷尔蒙驱动", icon: "💕", desc: "满足情感好奇，驱动社交话题", hooks: ["找对象", "脱单", "渣男鉴别", "前任"] },
];

// 脚本类型
const SCRIPT_TYPES = [
  { id: "teach", title: "教知识", icon: "📚", desc: "问题→解决方案→效果" },
  { id: "show", title: "晒过程", icon: "🎬", desc: "场景→过程→结果" },
  { id: "opinion", title: "聊观点", icon: "💬", desc: "现象→观点→共鸣" },
  { id: "story", title: "讲故事", icon: "📖", desc: "冲突→转折→结局" },
];

// 时长字数对照
const DURATION_WORDS: Record<number, { min: number; max: number }> = {
  30: { min: 110, max: 140 },
  45: { min: 170, max: 210 },
  60: { min: 230, max: 270 },
};

interface GeneratedCopy {
  title: string;
  openingHook: string;
  mainContent: string;
  closingCTA: string;
  fullScript: string;
  wordCount: number;
  usedElements: string[];
  usedHooks: string[];
}

export default function MixPage() {
  // 步骤状态
  const [step, setStep] = useState(1);

  // 用户输入
  const [industry, setIndustry] = useState("");
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState(30);
  const [scriptType, setScriptType] = useState("");
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [selectedHooks, setSelectedHooks] = useState<string[]>([]);

  // 生成结果
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedCopy | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleElement = (id: string) => {
    const el = VIRAL_ELEMENTS.find(e => e.id === id)!;
    if (selectedElements.includes(id)) {
      setSelectedElements(prev => prev.filter(e => e !== id));
      setSelectedHooks(prev => prev.filter(h => !el.hooks.includes(h)));
    } else if (selectedElements.length < 3) {
      setSelectedElements(prev => [...prev, id]);
      setSelectedHooks(prev => [...new Set([...prev, ...el.hooks])]);
    }
  };

  const toggleHook = (hook: string) => {
    setSelectedHooks(prev =>
      prev.includes(hook) ? prev.filter(h => h !== hook) : [...prev, hook]
    );
  };

  const handleGenerate = async () => {
    if (!industry || !goal || !scriptType || selectedElements.length === 0) {
      toast.error("请填写完整信息");
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/mix/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry,
          goal,
          duration,
          scriptType,
          viralElements: selectedElements,
          selectedHooks,
          targetWords: DURATION_WORDS[duration],
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "生成失败");

      setResult(data.copy);
      setStep(4);
      toast.success("文案生成成功！");
    } catch (err: any) {
      toast.error(err.message || "生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.fullScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setStep(1);
    setResult(null);
    setIndustry("");
    setGoal("");
    setScriptType("");
    setSelectedElements([]);
    setSelectedHooks([]);
    setDuration(30);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header
        title="营销文案生成"
        subtitle="薛老师爆款理论 · 一键生成营销文案"
        gradient="from-orange-600 to-amber-600"
      />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">

          {/* 步骤指示器 */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {["场景设定", "脚本类型", "爆款元素", "生成结果"].map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => result || i < step - 1 ? setStep(i + 1) : null}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    step === i + 1
                      ? "bg-orange-500 text-white"
                      : step > i + 1
                      ? "bg-green-500/20 text-green-400 cursor-pointer hover:bg-green-500/30"
                      : "bg-white/5 text-white/30"
                  }`}
                >
                  {step > i + 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
                  {label}
                </button>
                {i < 3 && <ChevronRight className="w-4 h-4 text-white/20" />}
              </div>
            ))}
          </div>

          {/* 步骤1：场景设定 */}
          {step === 1 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Target className="w-5 h-5 text-orange-400" />
                  第1步：场景设定
                </CardTitle>
                <CardDescription className="text-white/50">
                  告诉我你的行业和视频目的，AI帮你策划最适合的内容方向
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">你的行业领域</label>
                  <Input
                    placeholder="例如：美妆、宠物食品、职场培训、奶茶店..."
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/30 h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80">这条视频的目的</label>
                  <Input
                    placeholder="例如：卖产品、引流到店、涨粉、建立品牌认知..."
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/30 h-11"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-white/80">视频时长</label>
                  <div className="flex gap-3">
                    {[30, 45, 60].map(d => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                          duration === d
                            ? "border-orange-500 bg-orange-500/10 text-orange-400"
                            : "border-white/10 text-white/60 hover:border-white/30"
                        }`}
                      >
                        <div className="font-bold text-lg">{d}秒</div>
                        <div className="text-xs opacity-70">{DURATION_WORDS[d].min}~{DURATION_WORDS[d].max}字</div>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (!industry.trim() || !goal.trim()) {
                      toast.error("请填写行业和视频目的");
                      return;
                    }
                    setStep(2);
                  }}
                  className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 border-0 h-11"
                >
                  下一步：选择脚本类型
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 步骤2：脚本类型 */}
          {step === 2 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <BookOpen className="w-5 h-5 text-orange-400" />
                  第2步：选择脚本类型
                </CardTitle>
                <CardDescription className="text-white/50">
                  不同结构决定不同的传播效果
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {SCRIPT_TYPES.map(type => (
                    <div
                      key={type.id}
                      onClick={() => setScriptType(type.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        scriptType === type.id
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-white/10 bg-white/5 hover:border-white/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{type.icon}</span>
                        <span className="font-semibold text-white">{type.title}</span>
                        {scriptType === type.id && <CheckCircle2 className="w-4 h-4 text-orange-400 ml-auto" />}
                      </div>
                      <p className="text-xs text-white/50">{type.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1 border-white/20 text-white hover:bg-white/10">
                    返回
                  </Button>
                  <Button
                    onClick={() => scriptType ? setStep(3) : toast.error("请选择脚本类型")}
                    className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 border-0"
                  >
                    下一步：爆款元素
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 步骤3：爆款元素 */}
          {step === 3 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Sparkles className="w-5 h-5 text-orange-400" />
                  第3步：选择爆款元素（建议2个）
                </CardTitle>
                <CardDescription className="text-white/50">
                  薛老师8大爆款元素，组合使用效果更佳
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {VIRAL_ELEMENTS.map(el => (
                    <div
                      key={el.id}
                      onClick={() => toggleElement(el.id)}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedElements.includes(el.id)
                          ? "border-orange-500 bg-orange-500/10"
                          : selectedElements.length >= 3 && !selectedElements.includes(el.id)
                          ? "border-white/5 bg-white/2 opacity-40 cursor-not-allowed"
                          : "border-white/10 bg-white/5 hover:border-white/30"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-lg">{el.icon}</span>
                        <span className="text-sm font-semibold text-white">{el.title}</span>
                        {selectedElements.includes(el.id) && <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 ml-auto" />}
                      </div>
                      <p className="text-xs text-white/40">{el.desc}</p>
                    </div>
                  ))}
                </div>

                {/* 钩子词根选择 */}
                {selectedElements.length > 0 && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">选择钩子词根</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const all = selectedElements.flatMap(id => VIRAL_ELEMENTS.find(e => e.id === id)?.hooks || []);
                            setSelectedHooks([...new Set(all)]);
                          }}
                          className="text-xs text-orange-400 hover:text-orange-300"
                        >
                          全选
                        </button>
                        <span className="text-white/20">|</span>
                        <button onClick={() => setSelectedHooks([])} className="text-xs text-white/40 hover:text-white/60">
                          清空
                        </button>
                      </div>
                    </div>
                    {selectedElements.map(id => {
                      const el = VIRAL_ELEMENTS.find(e => e.id === id)!;
                      return (
                        <div key={id} className="space-y-2">
                          <span className="text-xs text-white/50">{el.icon} {el.title}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {el.hooks.map(hook => (
                              <button
                                key={hook}
                                onClick={() => toggleHook(hook)}
                                className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                                  selectedHooks.includes(hook)
                                    ? "border-orange-500 bg-orange-500/20 text-orange-300"
                                    : "border-white/15 text-white/50 hover:border-white/30"
                                }`}
                              >
                                {hook}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1 border-white/20 text-white hover:bg-white/10">
                    返回
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || selectedElements.length === 0 || selectedHooks.length === 0}
                    className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 border-0"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        生成营销文案
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 步骤4：生成结果 */}
          {step === 4 && result && (
            <div className="space-y-4">
              {/* 标题和操作 */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{result.title}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-white/40">{result.wordCount} 字</span>
                    <span className="text-sm text-white/40">约 {Math.ceil(result.wordCount / 4.5)} 秒</span>
                    <div className="flex gap-1">
                      {result.usedElements.map(el => {
                        const e = VIRAL_ELEMENTS.find(v => v.id === el);
                        return e ? (
                          <Badge key={el} variant="outline" className="text-xs border-orange-500/40 text-orange-400">
                            {e.icon} {e.title}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? "已复制" : "复制全文"}
                  </Button>
                </div>
              </div>

              {/* 三段式展示 */}
              <div className="grid gap-4">
                <Card className="bg-red-950/30 border-red-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-medium text-red-400">开头钩子（前3秒留住人）</span>
                    </div>
                    <p className="text-white/90 leading-relaxed">{result.openingHook}</p>
                  </CardContent>
                </Card>

                <Card className="bg-blue-950/30 border-blue-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-400">中间内容（价值输出）</span>
                    </div>
                    <p className="text-white/90 leading-relaxed whitespace-pre-wrap">{result.mainContent}</p>
                  </CardContent>
                </Card>

                <Card className="bg-green-950/30 border-green-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium text-green-400">结尾行动号召</span>
                    </div>
                    <p className="text-white/90 leading-relaxed">{result.closingCTA}</p>
                  </CardContent>
                </Card>
              </div>

              {/* 完整脚本可编辑 */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white/60">完整脚本（可编辑）</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={result.fullScript}
                    onChange={e => setResult({ ...result, fullScript: e.target.value, wordCount: e.target.value.length })}
                    rows={8}
                    className="resize-none bg-white/5 border-white/20 text-white"
                  />
                  <p className="text-xs text-white/30 mt-2">{result.fullScript.length} 字</p>
                </CardContent>
              </Card>

              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full border-white/20 text-white/60 hover:bg-white/10"
              >
                重新生成
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
