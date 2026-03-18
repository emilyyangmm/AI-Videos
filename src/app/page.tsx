"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Target, Sparkles, Lightbulb, Upload, FileText, Video, Film, Clock,
  CheckCircle2, Loader2, ChevronRight, RefreshCw,
  Play, Download, Trash2, Plus
} from "lucide-react";
import { toast } from "sonner";

// 类型定义
interface Project {
  id: string;
  industry: string;
  industry_analysis: any;
  selected_word_roots: any;
  status: string;
  created_at: string;
}

interface WordRoot {
  id: string;
  combination: {
    id: number;
    elements: string[];
    description: string;
    example: string;
  };
  is_selected: boolean;
}

interface Topic {
  id: string;
  title: string;
  conflict_point: string;
  emotion_hook: string;
  is_selected: boolean;
}

interface Material {
  id: string;
  type: string;
  url: string;
  description: string;
}

interface Script {
  id: string;
  title: string;
  duration: number;
  persona: string;
  opening_hook: any;
  middle_content: any[];
  ending_guide: any;
  shot_list: any[];
}

const STEPS = [
  { id: 1, title: "场景设定", icon: Target, description: "选择使用场景和时长" },
  { id: 2, title: "爆款词根", icon: Sparkles, description: "生成词根组合推荐" },
  { id: 3, title: "爆款选题", icon: Lightbulb, description: "生成爆款选题方案" },
  { id: 4, title: "素材上传", icon: Upload, description: "上传相关素材" },
  { id: 5, title: "脚本生成", icon: FileText, description: "生成基础脚本" },
  { id: 6, title: "分镜脚本", icon: Film, description: "按8秒拆分分镜" },
  { id: 7, title: "视频生成", icon: Video, description: "Veo生成视频" },
];

// 使用场景配置
const SCENARIOS = [
  {
    id: "ecommerce",
    title: "电商产品展示",
    icon: "🛍️",
    description: "淘宝、抖音小店等电商平台产品展示",
    recommendedDuration: [15, 45],
    reason: "淘宝官方数据：过长会拖累完播率权重。15秒足够展示痛点+解决方案+前后对比。前3秒决定80%流量池等级。",
    tips: ["前3秒必须抓住眼球", "突出痛点与解决方案", "展示前后对比效果"]
  },
  {
    id: "local_business",
    title: "实体店引流",
    icon: "🏪",
    description: "餐饮、美业、本地生活等实体店推广",
    recommendedDuration: [15, 30],
    reason: "TikTok/Reels算法建议：一个清晰的信息点+快速证明。适合展示美食出锅瞬间、环境氛围、优惠活动。",
    tips: ["展示最吸引人的瞬间", "突出环境氛围", "展示优惠活动"]
  },
  {
    id: "brand_story",
    title: "品牌故事/剧情类",
    icon: "🎬",
    description: "建立人设、情感共鸣的内容",
    recommendedDuration: [35, 55],
    reason: "抖音剧情类爆款集中区间：刚好完成起承转合——3秒钩子、22秒转折、48秒反转。超60秒流失率明显增加。",
    tips: ["3秒钩子抓住观众", "设置转折点", "结尾反转或情感升华"]
  },
  {
    id: "tutorial",
    title: "实用干货/教程类",
    icon: "📚",
    description: "美妆教程、产品使用方法等教学内容",
    recommendedDuration: [30, 60],
    reason: "足够讲清楚2-3个核心步骤。每增加1个信息点延长8秒左右。",
    tips: ["步骤清晰易懂", "每步控制在8秒内", "突出关键操作点"]
  }
];

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [project, setProject] = useState<Project | null>(null);
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 使用场景和视频时长
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(30);
  
  // 各步骤数据
  const [industryAnalysis, setIndustryAnalysis] = useState<any>(null);
  const [wordRoots, setWordRoots] = useState<WordRoot[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [shotScript, setShotScript] = useState<any>(null); // 分镜脚本
  const [optimizedShots, setOptimizedShots] = useState<any[]>([]); // 优化后的分镜
  const [videos, setVideos] = useState<any[]>([]);

  // 创建项目并开始
  const handleStartProject = async () => {
    if (!industry.trim()) {
      toast.error("请输入行业/赛道");
      return;
    }

    if (!selectedScenario) {
      toast.error("请先选择使用场景");
      return;
    }

    setLoading(true);
    try {
      // 创建项目（包含场景和时长信息）
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          industry,
          scenario: selectedScenario,
          videoDuration,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setProject(data.project);
        toast.success("项目创建成功！");
        
        // 自动开始赛道分析
        await analyzeIndustry(data.project.id);
      } else {
        toast.error(data.error || "创建项目失败");
      }
    } catch (error) {
      toast.error("创建项目失败");
    } finally {
      setLoading(false);
    }
  };

  // 赛道分析
  const analyzeIndustry = async (projectId: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/industry/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, industry }),
      });
      const data = await res.json();
      
      if (data.success) {
        // 合并场景和时长信息到分析结果中
        const analysisWithMeta = {
          ...data.analysis,
          scenario: selectedScenario,
          videoDuration: videoDuration,
        };
        setIndustryAnalysis(analysisWithMeta);
        setCurrentStep(2);
        toast.success("赛道分析完成！");
        
        // 自动生成词根组合
        await generateWordRoots(projectId, analysisWithMeta);
      } else {
        toast.error(data.error || "分析失败");
      }
    } catch (error) {
      toast.error("赛道分析失败");
    } finally {
      setLoading(false);
    }
  };

  // 生成词根组合
  const generateWordRoots = async (projectId: string, analysis: any) => {
    setLoading(true);
    try {
      const res = await fetch("/api/word-roots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectId, 
          industry,
          industryAnalysis: analysis 
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setWordRoots(data.combinations.map((combo: any, idx: number) => ({
          id: `wr_${idx}`,
          combination: combo,
          is_selected: false,
        })));
        setCurrentStep(2);
        toast.success("词根组合生成完成！");
      }
    } catch (error) {
      toast.error("词根组合生成失败");
    } finally {
      setLoading(false);
    }
  };

  // 选择词根组合
  const selectWordRoot = async (wordRootId: string) => {
    setWordRoots(prev => prev.map(wr => ({
      ...wr,
      is_selected: wr.id === wordRootId,
    })));
    
    const selected = wordRoots.find(wr => wr.id === wordRootId);
    if (selected && project) {
      // 生成选题
      setLoading(true);
      try {
        const res = await fetch("/api/topics/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            industry,
            wordRootCombination: selected.combination,
            scenario: selectedScenario,
            videoDuration: videoDuration,
          }),
        });
        const data = await res.json();
        
        if (data.success) {
          setTopics(data.topics);
          setCurrentStep(3);
          toast.success("选题生成完成！");
        }
      } catch (error) {
        toast.error("选题生成失败");
      } finally {
        setLoading(false);
      }
    }
  };

  // 换一批选题
  const refreshTopics = async () => {
    if (!project) return;
    const selected = wordRoots.find(wr => wr.is_selected);
    if (!selected) return;

    setLoading(true);
    try {
      const res = await fetch("/api/topics/generate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          industry,
          wordRootCombination: selected.combination,
          scenario: selectedScenario,
          videoDuration: videoDuration,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setTopics(data.topics);
        toast.success("已生成新选题！");
      }
    } catch (error) {
      toast.error("重新生成失败");
    } finally {
      setLoading(false);
    }
  };

  // 选择选题
  const selectTopic = async (topicId: string) => {
    setTopics(prev => prev.map(t => ({
      ...t,
      is_selected: t.id === topicId,
    })));
    setCurrentStep(4);
    toast.success("选题已确认，请上传素材");
  };

  // 上传素材
  const handleUploadMaterial = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    const formData = new FormData();
    formData.append("projectId", project.id);
    formData.append("type", file.type.startsWith("image") ? "image" : "video");
    formData.append("file", file);

    setLoading(true);
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.success) {
        setMaterials(prev => [...prev, data.material]);
        toast.success("素材上传成功！");
      }
    } catch (error) {
      toast.error("上传失败");
    } finally {
      setLoading(false);
    }
  };

  // 生成脚本
  const generateScript = async () => {
    if (!project) return;
    const selectedTopic = topics.find(t => t.is_selected);
    const selectedWordRoot = wordRoots.find(wr => wr.is_selected);
    if (!selectedTopic || !selectedWordRoot) {
      toast.error("请先选择选题");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          topic: selectedTopic,
          wordRoots: selectedWordRoot.combination,
          materials,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setScript(data.script);
        setCurrentStep(5);
        toast.success("脚本生成完成！");
      }
    } catch (error) {
      toast.error("脚本生成失败");
    } finally {
      setLoading(false);
    }
  };

  // 生成分镜脚本（按8秒拆分）
  const generateShotScript = async () => {
    if (!script) {
      toast.error("请先生成基础脚本");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/scripts/shots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project?.id,
          script,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setShotScript(data.shotScript);
        setCurrentStep(6);
        toast.success(`分镜脚本生成完成！共 ${data.shotScript.shotCount} 个分镜`);
      } else {
        toast.error(data.error || "分镜脚本生成失败");
      }
    } catch (error) {
      toast.error("分镜脚本生成失败");
    } finally {
      setLoading(false);
    }
  };

  // 优化Veo提示词
  const optimizeVeoPrompts = async () => {
    if (!shotScript || !shotScript.shots) {
      toast.error("请先生成分镜脚本");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/veo/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shots: shotScript.shots,
          aspectRatio: "16:9",
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setOptimizedShots(data.shots);
        toast.success(`提示词优化完成！${data.shotCount} 个分镜已准备就绪`);
      } else {
        toast.error(data.error || "提示词优化失败");
      }
    } catch (error) {
      toast.error("提示词优化失败");
    } finally {
      setLoading(false);
    }
  };

  // 直接生成视频（从基础脚本）
  const generateVideos = async () => {
    if (!script || !project) {
      toast.error("请先生成基础脚本");
      return;
    }

    setLoading(true);
    try {
      // 将基础脚本转换为简化的分镜格式
      const shots: any[] = [];
      
      // 开头
      if (script.opening_hook) {
        shots.push({
          shotId: "opening",
          type: "opening",
          duration: 8,
          visual: script.opening_hook.visual,
          dialogue: script.opening_hook.script,
          veoPrompt: `${script.opening_hook.visual}, cinematic, professional camera movement, high quality`,
        });
      }
      
      // 中间内容
      if (script.middle_content) {
        script.middle_content.forEach((section: any, index: number) => {
          shots.push({
            shotId: `middle-${index}`,
            type: "content",
            duration: 8,
            visual: section.visual,
            dialogue: section.script,
            veoPrompt: `${section.visual}, cinematic, professional camera movement, high quality`,
          });
        });
      }
      
      // 结尾
      if (script.ending_guide) {
        shots.push({
          shotId: "ending",
          type: "ending",
          duration: 8,
          visual: script.ending_guide.visual,
          dialogue: script.ending_guide.cta,
          veoPrompt: `${script.ending_guide.visual}, cinematic, professional camera movement, high quality`,
        });
      }

      if (shots.length === 0) {
        toast.error("没有可生成的分镜");
        return;
      }

      // 提交批量生成
      const res = await fetch("/api/veo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          shots: shots,
          aspectRatio: "16:9",
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        // 初始化所有任务状态
        const newOperations = new Map(veoOperations);
        data.results.forEach((r: any) => {
          if (r.success && r.operationName) {
            newOperations.set(r.operationName, {
              status: "processing",
              progress: 5,
              shotId: r.shotId,
            });
            startPolling(r.operationName, r.shotId);
          }
        });
        
        setVeoOperations(newOperations);
        setCurrentStep(7);
        toast.success(`已提交 ${shots.length} 个视频生成任务`);
      } else {
        toast.error(data.error || "提交失败");
      }
    } catch (error) {
      toast.error("视频生成提交失败");
    } finally {
      setLoading(false);
    }
  };

  // Veo 视频生成状态
  const [veoOperations, setVeoOperations] = useState<Map<string, { status: string; progress: number; videoUrl?: string; shotId?: string }>>(new Map());
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 提交 Veo 视频生成任务（批量）
  const submitVeoTasks = async () => {
    const shotsToGenerate = optimizedShots.length > 0 ? optimizedShots : shotScript?.shots;
    
    if (!project || !shotsToGenerate || shotsToGenerate.length === 0) {
      toast.error("没有可生成的分镜");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/veo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          shots: shotsToGenerate,
          aspectRatio: "16:9",
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        // 初始化所有任务状态
        const newOperations = new Map(veoOperations);
        data.results.forEach((r: any) => {
          if (r.success && r.operationName) {
            newOperations.set(r.operationName, {
              status: "processing",
              progress: 5,
              shotId: r.shotId,
            });
            startPolling(r.operationName, r.shotId);
          }
        });
        
        setVeoOperations(newOperations);
        setCurrentStep(7);
        toast.success(data.message);
      } else {
        toast.error(data.error || "提交失败");
      }
    } catch (error) {
      toast.error("提交失败");
    } finally {
      setLoading(false);
    }
  };

  // 轮询任务状态
  const startPolling = (operationName: string, shotId?: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/veo/generate?operation_name=${encodeURIComponent(operationName)}`);
        const data = await res.json();
        
        setVeoOperations(prev => {
          const newMap = new Map(prev);
          const current = newMap.get(operationName) || { status: "processing", progress: 5, shotId };
          
          if (data.done) {
            if (data.success) {
              newMap.set(operationName, {
                status: "completed",
                progress: 100,
                videoUrl: data.video_url || data.gcs_uri,
                shotId,
              });
              
              // 添加到视频列表
              setVideos(v => [...v, {
                shotId,
                operationName,
                videoUrl: data.video_url || data.gcs_uri,
                success: true,
              }]);
              
              toast.success(`分镜 ${shotId} 视频生成完成`);
            } else {
              newMap.set(operationName, {
                status: "failed",
                progress: 0,
                shotId,
              });
              toast.error(`分镜 ${shotId} 生成失败: ${data.error}`);
            }
            
            // 停止轮询
            const timer = pollingRef.current.get(operationName);
            if (timer) {
              clearInterval(timer);
              pollingRef.current.delete(operationName);
            }
          } else {
            // 更新进度
            newMap.set(operationName, {
              ...current,
              progress: Math.min(current.progress + 4, 92),
            });
          }
          
          return newMap;
        });
      } catch (error) {
        console.error("轮询失败:", error);
      }
    };
    
    // 每8秒轮询一次
    const timer = setInterval(poll, 8000);
    pollingRef.current.set(operationName, timer);
    
    // 立即执行一次
    poll();
  };

  // 计算总体进度
  const totalProgress = veoOperations.size > 0
    ? Array.from(veoOperations.values()).reduce((sum, op) => sum + op.progress, 0) / veoOperations.size
    : 0;
  
  const completedCount = Array.from(veoOperations.values()).filter(op => op.status === "completed").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                🎬 爆款短视频智能生成
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                基于薛辉短视频架构方法论 · AI驱动创作
              </p>
            </div>
            {project && (
              <Badge variant="outline" className="text-sm">
                项目ID: {project.id.slice(0, 8)}...
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* 步骤导航 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => currentStep >= step.id && setCurrentStep(step.id)}
                  disabled={currentStep < step.id}
                  className={`flex flex-col items-center ${
                    currentStep >= step.id ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                    currentStep > step.id
                      ? "bg-green-500 border-green-500 text-white"
                      : currentStep === step.id
                      ? "bg-purple-500 border-purple-500 text-white"
                      : "bg-gray-100 border-gray-300 text-gray-400"
                  }`}>
                    {currentStep > step.id ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  <span className={`mt-2 text-xs font-medium ${
                    currentStep >= step.id ? "text-gray-900 dark:text-white" : "text-gray-400"
                  }`}>
                    {step.title}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="w-5 h-5 text-gray-300 mx-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 进度条 */}
        <Progress value={(currentStep / STEPS.length) * 100} className="mb-8 h-2" />

        {/* 步骤内容 */}
        <div className="max-w-4xl mx-auto">
          {/* 步骤1: 场景设定 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* 场景选择 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    选择使用场景
                  </CardTitle>
                  <CardDescription>
                    根据您的使用场景，系统会推荐最合适的视频时长和内容结构
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SCENARIOS.map((scenario) => (
                      <div
                        key={scenario.id}
                        onClick={() => {
                          setSelectedScenario(scenario.id);
                          setVideoDuration(scenario.recommendedDuration[0]);
                        }}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedScenario === scenario.id
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                            : "border-gray-200 hover:border-purple-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{scenario.icon}</span>
                          <h4 className="font-medium">{scenario.title}</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {scenario.description}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-purple-600" />
                          <span className="text-purple-600 font-medium">
                            推荐 {scenario.recommendedDuration[0]}-{scenario.recommendedDuration[1]}秒
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 时长选择和行业输入 */}
              {selectedScenario && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-purple-600" />
                      设置视频时长
                    </CardTitle>
                    <CardDescription>
                      {SCENARIOS.find(s => s.id === selectedScenario)?.reason}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 时长滑块 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">视频时长</span>
                        <Badge variant="secondary" className="text-lg px-3 py-1">
                          {videoDuration} 秒
                        </Badge>
                      </div>
                      <input
                        type="range"
                        min={SCENARIOS.find(s => s.id === selectedScenario)?.recommendedDuration[0]}
                        max={SCENARIOS.find(s => s.id === selectedScenario)?.recommendedDuration[1]}
                        value={videoDuration}
                        onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{SCENARIOS.find(s => s.id === selectedScenario)?.recommendedDuration[0]}秒</span>
                        <span>{SCENARIOS.find(s => s.id === selectedScenario)?.recommendedDuration[1]}秒</span>
                      </div>
                    </div>

                    {/* 分镜数量提示 */}
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        📹 预计生成 <strong>{Math.ceil(videoDuration / 8)} 个分镜</strong>（每分镜8秒）
                      </p>
                    </div>

                    {/* 行业输入 */}
                    <div className="space-y-2 pt-4 border-t">
                      <label className="text-sm font-medium">您的行业/领域是什么？</label>
                      <Input
                        placeholder="例如：职场、教育、美妆、母婴、健身、美食、情感、科技..."
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleStartProject()}
                        className="text-lg"
                      />
                      
                      <div className="flex gap-2 flex-wrap">
                        {["职场", "教育", "美妆", "母婴", "健身", "美食", "情感", "科技"].map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="cursor-pointer hover:bg-purple-100"
                            onClick={() => setIndustry(tag)}
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handleStartProject}
                      disabled={loading || !industry.trim()}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          正在分析...
                        </>
                      ) : (
                        "开始生成"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* 空状态提示 */}
              {!selectedScenario && (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">请先选择一个使用场景</p>
                </div>
              )}

              {/* 赛道分析结果 */}
              {industryAnalysis && (
                <Card>
                  <CardHeader>
                    <CardTitle>📊 赛道分析结果</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-purple-50 dark:bg-gray-800 rounded-lg">
                        <h4 className="font-medium mb-2">目标人群</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {industryAnalysis.targetAudience?.age || "分析中..."}
                        </p>
                      </div>
                      
                      <div className="p-4 bg-pink-50 dark:bg-gray-800 rounded-lg">
                        <h4 className="font-medium mb-2">变现方式</h4>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          {industryAnalysis.monetizationMethods?.slice(0, 3).map((m: any, i: number) => (
                            <li key={i}>• {m.method}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 步骤2: 爆款词根 */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  第2步：爆款词根组合
                </CardTitle>
                <CardDescription>
                  选择一组词根组合，用于生成爆款选题
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {wordRoots.map((wr) => (
                  <div
                    key={wr.id}
                    onClick={() => selectWordRoot(wr.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      wr.is_selected
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">组合 {wr.combination.id}</h4>
                      {wr.is_selected && <CheckCircle2 className="w-5 h-5 text-purple-600" />}
                    </div>
                    <div className="flex gap-2 flex-wrap mb-2">
                      {wr.combination.elements.map((elem: string, i: number) => (
                        <Badge key={i} variant="secondary">{elem}</Badge>
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {wr.combination.description}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      示例：{wr.combination.example}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 步骤3: 爆款选题 */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-purple-600" />
                  第3步：爆款选题
                </CardTitle>
                <CardDescription>
                  选择一个选题进行脚本创作
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  onClick={refreshTopics}
                  disabled={loading}
                  className="mb-4"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  换一批
                </Button>

                {topics.map((topic) => (
                  <div
                    key={topic.id}
                    onClick={() => selectTopic(topic.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      topic.is_selected
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{topic.title}</h4>
                      {topic.is_selected && <CheckCircle2 className="w-5 h-5 text-purple-600" />}
                    </div>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium text-gray-500">冲突点：</span>{topic.conflict_point}</p>
                      <p><span className="font-medium text-gray-500">情绪钩子：</span>{topic.emotion_hook}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 步骤4: 素材上传 */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-600" />
                  第4步：素材上传
                </CardTitle>
                <CardDescription>
                  上传相关素材（图片/视频），用于脚本创作参考
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-sm text-gray-600 mb-4">
                    点击或拖拽文件上传
                  </p>
                  <Input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleUploadMaterial}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button asChild>
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Plus className="w-4 h-4 mr-2" />
                      选择文件
                    </label>
                  </Button>
                </div>

                {materials.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {materials.map((mat) => (
                      <div key={mat.id} className="relative group">
                        <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                          {mat.type === "image" ? (
                            <img src={mat.url} alt={mat.description || ""} className="w-full h-full object-cover" />
                          ) : (
                            <video src={mat.url} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  onClick={generateScript}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成脚本中...
                    </>
                  ) : (
                    "生成脚本"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 步骤5: 脚本生成 */}
          {currentStep === 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  第5步：脚本确认
                </CardTitle>
                <CardDescription>
                  查看生成的脚本，确认后生成视频
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {script && (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{script.title}</h3>
                      <Badge>{script.duration}秒</Badge>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-purple-50 dark:bg-gray-800 rounded-lg">
                        <h4 className="font-medium mb-2">🎬 开头3秒钩子</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {script.opening_hook?.visual}
                        </p>
                        <p className="text-sm mt-2 italic">
                          "{script.opening_hook?.script}"
                        </p>
                      </div>

                      <div className="p-4 bg-pink-50 dark:bg-gray-800 rounded-lg">
                        <h4 className="font-medium mb-2">📝 中间内容</h4>
                        {script.middle_content?.map((section: any, i: number) => (
                          <div key={i} className="mb-3">
                            <p className="font-medium text-sm">{section.section}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{section.visual}</p>
                            <p className="text-sm italic">"{section.script}"</p>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 bg-orange-50 dark:bg-gray-800 rounded-lg">
                        <h4 className="font-medium mb-2">🎯 结尾引导</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {script.ending_guide?.visual}
                        </p>
                        <p className="text-sm mt-2 italic">
                          "{script.ending_guide?.cta}"
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={generateShotScript}
                        disabled={loading}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            生成分镜脚本中...
                          </>
                        ) : (
                          <>
                            <Film className="w-4 h-4 mr-2" />
                            生成分镜脚本
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={generateVideos}
                        variant="outline"
                        className="border-purple-500 text-purple-600 hover:bg-purple-50"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        直接生成视频
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* 步骤6: 视频生成 */}
          {currentStep === 6 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-purple-600" />
                  第6步：分镜脚本
                </CardTitle>
                <CardDescription>
                  按8秒拆分的分镜脚本，支持编辑和优化提示词
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 分镜列表 */}
                {shotScript && shotScript.shots.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-medium">{shotScript.title}</h3>
                        <p className="text-sm text-gray-500">总时长: {shotScript.totalDuration}秒 · {shotScript.shotCount} 个分镜</p>
                      </div>
                      <Button
                        onClick={optimizeVeoPrompts}
                        disabled={loading || optimizedShots.length > 0}
                        variant="outline"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {optimizedShots.length > 0 ? "提示词已优化" : "优化提示词"}
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {(optimizedShots.length > 0 ? optimizedShots : shotScript.shots).map((shot: any, index: number) => (
                        <div key={shot.shotId || index} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">分镜 {index + 1}</Badge>
                              <span className="text-sm text-gray-500">{shot.duration}秒</span>
                            </div>
                            <Badge variant={shot.type === 'opening' ? 'default' : shot.type === 'ending' ? 'destructive' : 'outline'}>
                              {shot.type === 'opening' ? '开头' : shot.type === 'ending' ? '结尾' : '内容'}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            {/* 画面描述 */}
                            <div>
                              <label className="text-xs font-medium text-gray-500">画面描述</label>
                              <p className="text-sm mt-1">{shot.visual}</p>
                            </div>

                            {/* 台词 */}
                            <div>
                              <label className="text-xs font-medium text-gray-500">台词</label>
                              <p className="text-sm mt-1 italic">"{shot.dialogue}"</p>
                            </div>

                            {/* Veo提示词 */}
                            {(shot.veoPrompt || shot.optimizedPrompts) && (
                              <div className="mt-3 pt-3 border-t">
                                <label className="text-xs font-medium text-purple-600">Veo 提示词</label>
                                {shot.optimizedPrompts ? (
                                  <div className="mt-2 space-y-2">
                                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                                      <span className="text-xs text-gray-500">中文：</span>
                                      <p className="text-sm">{shot.optimizedPrompts.chinese}</p>
                                    </div>
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                                      <span className="text-xs text-gray-500">English：</span>
                                      <p className="text-sm">{shot.optimizedPrompts.english}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm mt-1 text-gray-600">{shot.veoPrompt}</p>
                                )}
                              </div>
                            )}

                            {/* 运镜提示 */}
                            {shot.cameraHint && (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Video className="w-3 h-3" />
                                {shot.cameraHint}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={submitVeoTasks}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          提交中...
                        </>
                      ) : (
                        <>
                          <Video className="w-4 h-4 mr-2" />
                          提交视频生成任务
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <Film className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">请先在步骤5生成基础脚本后，点击"生成分镜脚本"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 步骤7: 视频生成 */}
          {currentStep === 7 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-purple-600" />
                  第7步：视频生成 (Google Veo 3.1)
                </CardTitle>
                <CardDescription>
                  AI正在生成您的爆款短视频
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 总体进度 */}
                {veoOperations.size > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>总体进度</span>
                      <span>{completedCount}/{veoOperations.size} 完成</span>
                    </div>
                    <Progress value={totalProgress} className="h-3" />
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      视频生成通常需要 2~4 分钟，请耐心等待
                    </p>
                  </div>
                )}

                {/* 各分镜状态 */}
                {veoOperations.size > 0 && (
                  <div className="space-y-3">
                    {Array.from(veoOperations.entries()).map(([opName, op], index) => (
                      <div key={opName} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">分镜 {op.shotId || index + 1}</span>
                          <Badge variant={
                            op.status === "completed" ? "default" : 
                            op.status === "failed" ? "destructive" : "secondary"
                          }>
                            {op.status === "completed" ? "已完成" : 
                             op.status === "failed" ? "失败" : "生成中..."}
                          </Badge>
                        </div>
                        <Progress value={op.progress} className="h-2" />
                      </div>
                    ))}
                  </div>
                )}

                {/* 生成的视频 */}
                {videos.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">生成的视频</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {videos.map((video: any, i: number) => (
                        <div key={i} className="relative rounded-lg overflow-hidden bg-gray-100">
                          {video.videoUrl?.startsWith("gs://") ? (
                            <div className="aspect-video flex flex-col items-center justify-center p-4 bg-gray-100">
                              <Video className="w-12 h-12 text-gray-400 mb-2" />
                              <p className="text-sm text-gray-600 text-center">视频已存储在 GCS</p>
                              <code className="text-xs bg-gray-200 px-2 py-1 rounded mt-2 break-all">
                                {video.videoUrl}
                              </code>
                            </div>
                          ) : (
                            <video
                              src={video.videoUrl}
                              controls
                              className="w-full aspect-video"
                            />
                          )}
                          <div className="absolute bottom-2 left-2">
                            <Badge variant="secondary">
                              分镜 {video.shotId || i + 1}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 空状态 */}
                {veoOperations.size === 0 && (
                  <div className="text-center py-12">
                    <Video className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">等待提交视频生成任务...</p>
                  </div>
                )}

                {/* 导出按钮 */}
                {completedCount === veoOperations.size && veoOperations.size > 0 && (
                  <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600">
                    <Download className="w-4 h-4 mr-2" />
                    导出最终视频
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
