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
    conflictIndex?: string;
    conflictAnalysis?: string;
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
  materialUsagePlan?: string;
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

// 维度一：商户类型配置
const MERCHANT_TYPES = [
  {
    id: "ecommerce",
    title: "电商卖家",
    icon: "🛍️",
    examples: "淘宝/抖音小店、跨境电商",
    goal: "直接转化，展示产品卖点",
    recommendedDuration: [15, 45],
    recommendedElements: "成本+人群+最差",
    style: "快节奏、直击痛点、强转化导向"
  },
  {
    id: "local_business",
    title: "实体店商家",
    icon: "🏪",
    examples: "餐饮、美业、教育、本地生活",
    goal: "引流到店，展示环境/服务",
    recommendedDuration: [15, 30],
    recommendedElements: "人群+猎奇+怀旧",
    style: "生活化、真实感、引流导向"
  },
  {
    id: "brand_owner",
    title: "品牌主理人",
    icon: "💎",
    examples: "自有品牌、新消费品牌",
    goal: "建立品牌认知，讲情怀/故事",
    recommendedDuration: [35, 55],
    recommendedElements: "头牌效应+反差+荷尔蒙",
    style: "剧情化、情感丰富、品质感"
  },
  {
    id: "knowledge_blogger",
    title: "知识博主/干货",
    icon: "📚",
    examples: "教程、测评、科普",
    goal: "建立专业信任，收藏/复看",
    recommendedDuration: [45, 60],
    recommendedElements: "猎奇+成本+头牌效应",
    style: "专业、易懂、干货导向"
  },
  {
    id: "story_ip",
    title: "剧情/IP账号",
    icon: "🎬",
    examples: "搞笑、情感、剧情号",
    goal: "涨粉，建立人设",
    recommendedDuration: [35, 55],
    recommendedElements: "反差+荷尔蒙+怀旧",
    style: "剧情化、人设鲜明、情绪共鸣"
  }
];

// 维度二：行业领域
const INDUSTRIES = [
  "职场", "教育", "美妆", "母婴", "健身", "美食", 
  "情感", "科技", "搞笑", "穿搭", "家居", "宠物", 
  "汽车", "财经", "法律", "摄影", "旅行", "游戏"
];

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 维度一：商户类型
  const [selectedMerchantType, setSelectedMerchantType] = useState<string | null>(null);
  // 维度二：行业领域
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [customIndustry, setCustomIndustry] = useState<string>("");
  // 视频时长
  const [videoDuration, setVideoDuration] = useState<number>(30);
  
  // 各步骤数据
  const [industryAnalysis, setIndustryAnalysis] = useState<any>(null);
  const [wordRoots, setWordRoots] = useState<WordRoot[]>([]);
  const [wordRootAnalysis, setWordRootAnalysis] = useState<any>(null); // 词根分析过程
  const [topics, setTopics] = useState<Topic[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [shotScript, setShotScript] = useState<any>(null); // 分镜脚本
  const [optimizedShots, setOptimizedShots] = useState<any[]>([]); // 优化后的分镜
  const [videos, setVideos] = useState<any[]>([]);

  // 获取实际行业值
  const getActualIndustry = () => customIndustry.trim() || selectedIndustry;
  
  // 获取选中的商户类型配置
  const getSelectedMerchantConfig = () => MERCHANT_TYPES.find(m => m.id === selectedMerchantType);

  // 创建项目并开始
  const handleStartProject = async () => {
    const actualIndustry = getActualIndustry();
    
    if (!actualIndustry) {
      toast.error("请选择或输入行业领域");
      return;
    }

    if (!selectedMerchantType) {
      toast.error("请选择商户类型");
      return;
    }

    setLoading(true);
    try {
      // 创建项目（包含商户类型和时长信息）
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          industry: actualIndustry,
          merchantType: selectedMerchantType,
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
    const actualIndustry = getActualIndustry();
    try {
      const res = await fetch("/api/industry/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectId, 
          industry: actualIndustry,
          merchantType: selectedMerchantType,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        // 合并商户类型和时长信息到分析结果中
        const analysisWithMeta = {
          ...data.analysis,
          merchantType: selectedMerchantType,
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
    const actualIndustry = getActualIndustry();
    try {
      const res = await fetch("/api/word-roots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectId, 
          industry: actualIndustry,
          industryAnalysis: analysis 
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        // 保存词根分析过程
        setWordRootAnalysis(data.analysis || null);
        
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
    const actualIndustry = getActualIndustry();
    if (selected && project) {
      // 生成选题
      setLoading(true);
      try {
        const res = await fetch("/api/topics/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            industry: actualIndustry,
            wordRootCombination: selected.combination,
            merchantType: selectedMerchantType,
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
    const actualIndustry = getActualIndustry();

    setLoading(true);
    try {
      const res = await fetch("/api/topics/generate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          industry: actualIndustry,
          wordRootCombination: selected.combination,
          merchantType: selectedMerchantType,
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
  const [materialAnalysis, setMaterialAnalysis] = useState<any[]>([]);
  
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
      // 准备素材数据
      const materialsData = materials.map(m => ({
        type: m.type,
        uri: m.url,
        description: m.description || '',
      }));

      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          topic: selectedTopic,
          wordRoots: selectedWordRoot.combination,
          materials: materialsData,
          merchantType: selectedMerchantType,
          videoDuration: videoDuration,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setScript(data.script);
        if (data.materialAnalysis && data.materialAnalysis.length > 0) {
          setMaterialAnalysis(data.materialAnalysis);
        }
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
          {/* 步骤1: 双维度设定 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* 维度一：商户类型 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    维度一：你的商户类型
                  </CardTitle>
                  <CardDescription>
                    选择你的商户类型，系统会推荐最合适的视频时长和内容策略
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {MERCHANT_TYPES.map((merchant) => (
                      <div
                        key={merchant.id}
                        onClick={() => {
                          setSelectedMerchantType(merchant.id);
                          setVideoDuration(merchant.recommendedDuration[0]);
                        }}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedMerchantType === merchant.id
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                            : "border-gray-200 hover:border-purple-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{merchant.icon}</span>
                          <h4 className="font-medium">{merchant.title}</h4>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{merchant.examples}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-3.5 h-3.5 text-purple-600" />
                          <span className="text-purple-600 font-medium">
                            {merchant.recommendedDuration[0]}-{merchant.recommendedDuration[1]}秒
                          </span>
                        </div>
                        {selectedMerchantType === merchant.id && (
                          <div className="mt-2 pt-2 border-t border-purple-200">
                            <p className="text-xs text-purple-600">
                              <span className="font-medium">目标：</span>{merchant.goal}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 维度二：行业领域 + 时长设置 */}
              {selectedMerchantType && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-600" />
                      维度二：你的行业领域
                    </CardTitle>
                    <CardDescription>
                      选择或输入你的行业领域，系统将生成精准的内容方向
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 时长设置 */}
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">视频时长</span>
                        <Badge variant="secondary" className="text-lg px-3 py-1">
                          {videoDuration} 秒
                        </Badge>
                      </div>
                      <input
                        type="range"
                        min={getSelectedMerchantConfig()?.recommendedDuration[0]}
                        max={getSelectedMerchantConfig()?.recommendedDuration[1]}
                        value={videoDuration}
                        onChange={(e) => setVideoDuration(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{getSelectedMerchantConfig()?.recommendedDuration[0]}秒</span>
                        <span className="text-purple-600">预计 {Math.ceil(videoDuration / 8)} 个分镜</span>
                        <span>{getSelectedMerchantConfig()?.recommendedDuration[1]}秒</span>
                      </div>
                    </div>

                    {/* 预设行业 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">选择行业（点击选择）</label>
                      <div className="flex gap-2 flex-wrap">
                        {INDUSTRIES.map((ind) => (
                          <Badge
                            key={ind}
                            variant={selectedIndustry === ind ? "default" : "outline"}
                            className={`cursor-pointer transition-all ${
                              selectedIndustry === ind 
                                ? "bg-purple-600 hover:bg-purple-700" 
                                : "hover:bg-purple-100"
                            }`}
                            onClick={() => {
                              setSelectedIndustry(ind);
                              setCustomIndustry("");
                            }}
                          >
                            {ind}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* 自定义行业 */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">或自定义输入</label>
                      <Input
                        placeholder="输入你的行业领域..."
                        value={customIndustry}
                        onChange={(e) => {
                          setCustomIndustry(e.target.value);
                          setSelectedIndustry("");
                        }}
                        onKeyPress={(e) => e.key === "Enter" && handleStartProject()}
                        className="text-lg"
                      />
                    </div>

                    {/* 智能分析预览 */}
                    {getActualIndustry() && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
                        <h4 className="font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4" />
                          智能分析预览
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                            <span className="text-gray-500">商户类型</span>
                            <p className="font-medium mt-1">{getSelectedMerchantConfig()?.title}</p>
                          </div>
                          <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                            <span className="text-gray-500">行业领域</span>
                            <p className="font-medium mt-1">{getActualIndustry()}</p>
                          </div>
                          <div className="p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                            <span className="text-gray-500">推荐元素</span>
                            <p className="font-medium mt-1">{getSelectedMerchantConfig()?.recommendedElements}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleStartProject}
                      disabled={loading || !getActualIndustry()}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          正在分析...
                        </>
                      ) : (
                        "开始智能分析"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* 空状态提示 */}
              {!selectedMerchantType && (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">请先选择你的商户类型</p>
                </div>
              )}

              {/* 赛道分析结果 */}
              {industryAnalysis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      📊 赛道分析结果
                    </CardTitle>
                    <CardDescription>
                      基于你的商户类型和行业领域，系统为你生成以下分析
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-purple-50 dark:bg-gray-800 rounded-lg">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <span className="text-purple-600">👥</span> 目标人群特征
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {industryAnalysis.targetAudience?.description || 
                           `${industryAnalysis.targetAudience?.age || "分析中..."}`}
                        </p>
                      </div>
                      
                      <div className="p-4 bg-pink-50 dark:bg-gray-800 rounded-lg">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <span className="text-pink-600">💰</span> 适合的变现方式
                        </h4>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          {industryAnalysis.monetizationMethods?.slice(0, 3).map((m: any, i: number) => (
                            <li key={i}>• {m.method || m}</li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="p-4 bg-orange-50 dark:bg-gray-800 rounded-lg">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <span className="text-orange-600">🔥</span> 推荐爆款元素
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {industryAnalysis.recommendedElements || getSelectedMerchantConfig()?.recommendedElements}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* 步骤2: 爆款词根 */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* 词根分析过程 */}
              {wordRootAnalysis && (
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <span className="text-blue-600">🧠</span> 词根组合分析过程
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 行业心理分析 */}
                    <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                      <h4 className="font-medium text-sm text-gray-500 mb-1">行业用户心理</h4>
                      <p className="text-sm">{wordRootAnalysis.industryPsychology || "分析中..."}</p>
                    </div>
                    
                    {/* 过滤后的词根 */}
                    <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                      <h4 className="font-medium text-sm text-gray-500 mb-2">商户类型过滤后的高权重词根</h4>
                      <div className="flex gap-2 flex-wrap">
                        {(wordRootAnalysis.filteredElements || []).map((elem: string, i: number) => (
                          <Badge key={i} variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200">
                            {elem}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    {/* 过滤理由 */}
                    {wordRootAnalysis.filterReason && (
                      <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                        <h4 className="font-medium text-sm text-gray-500 mb-1">过滤理由</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{wordRootAnalysis.filterReason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 词根组合推荐 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    第2步：选择词根组合
                  </CardTitle>
                  <CardDescription>
                    基于分析结果，为你推荐3组高冲突指数的词根组合
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {wordRoots.map((wr, index) => (
                    <div
                      key={wr.id}
                      onClick={() => selectWordRoot(wr.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        wr.is_selected
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                          : "border-gray-200 hover:border-purple-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-purple-600">组合 {index + 1}</span>
                          {wr.combination.conflictIndex && (
                            <Badge variant={wr.combination.conflictIndex === '高' ? 'default' : 'secondary'} 
                                   className={wr.combination.conflictIndex === '高' ? 'bg-green-500' : ''}>
                              冲突指数：{wr.combination.conflictIndex}
                            </Badge>
                          )}
                        </div>
                        {wr.is_selected && <CheckCircle2 className="w-5 h-5 text-purple-600" />}
                      </div>
                      
                      {/* 词根标签 */}
                      <div className="flex gap-2 flex-wrap mb-3">
                        {wr.combination.elements.map((elem: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-sm py-1 px-3">
                            {elem}
                          </Badge>
                        ))}
                      </div>
                      
                      {/* 冲突分析 */}
                      {wr.combination.conflictAnalysis && (
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm mb-2">
                          <span className="text-blue-600 font-medium">冲突解析：</span>
                          <span className="text-gray-600 dark:text-gray-400 ml-1">{wr.combination.conflictAnalysis}</span>
                        </div>
                      )}
                      
                      {/* 推荐理由 */}
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {wr.combination.description}
                      </p>
                      
                      {/* 示例标题 */}
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-xs text-gray-500">示例标题：</span>
                        <span className="text-sm font-medium ml-1">{wr.combination.example}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 步骤3: 爆款选题 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-purple-600" />
                    第3步：选择爆款选题
                  </CardTitle>
                  <CardDescription>
                    每个选题包含7种不同风格的标题变体，点击展开查看详情
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-sm">
                      💡 提示：每个选题的主标题是综合7种风格的最佳选择
                    </Badge>
                    <Button
                      variant="outline"
                      onClick={refreshTopics}
                      disabled={loading}
                      size="sm"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      换一批
                    </Button>
                  </div>

                  {topics.map((topic: any, topicIndex: number) => (
                    <Card
                      key={topic.id}
                      className={`overflow-hidden transition-all cursor-pointer ${
                        topic.is_selected
                          ? "border-purple-500 ring-2 ring-purple-500/20"
                          : "border-gray-200 hover:border-purple-300"
                      }`}
                      onClick={() => selectTopic(topic.id)}
                    >
                      {/* 选题头部 */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-purple-600">选题 {topicIndex + 1}</Badge>
                              {topic.is_selected && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  已选择
                                </Badge>
                              )}
                            </div>
                            <h4 className="text-lg font-semibold">{topic.title}</h4>
                          </div>
                          {topic.is_selected && (
                            <CheckCircle2 className="w-6 h-6 text-purple-600" />
                          )}
                        </div>
                        
                        {/* 核心冲突和情绪钩子 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <span className="text-xs text-purple-600 font-medium">💥 核心冲突</span>
                            <p className="text-sm mt-1">{topic.conflict_point}</p>
                          </div>
                          <div className="p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
                            <span className="text-xs text-pink-600 font-medium">🎭 情绪钩子</span>
                            <p className="text-sm mt-1">{topic.emotion_hook}</p>
                          </div>
                        </div>
                      </div>

                      {/* 7种风格变体 */}
                      {topic.styleVariants && topic.styleVariants.length > 0 && (
                        <div className="border-t bg-gray-50/50 dark:bg-gray-800/50">
                          <div className="p-3">
                            <p className="text-xs font-medium text-gray-500 mb-3">
                              🎨 7种风格标题变体（点击查看详情）
                            </p>
                            <div className="space-y-2">
                              {topic.styleVariants.map((variant: any, vIndex: number) => (
                                <div
                                  key={vIndex}
                                  className="p-3 bg-white dark:bg-gray-800 rounded-lg border hover:shadow-md transition-shadow"
                                >
                                  <div className="flex items-start gap-3">
                                    <Badge 
                                      variant="outline" 
                                      className="shrink-0 text-xs"
                                      style={{
                                        borderColor: 
                                          variant.styleId === 'suspense' ? '#f59e0b' :
                                          variant.styleId === 'authority' ? '#3b82f6' :
                                          variant.styleId === 'trend' ? '#ec4899' :
                                          variant.styleId === 'contrast' ? '#ef4444' :
                                          variant.styleId === 'tutorial' ? '#10b981' :
                                          variant.styleId === 'pain' ? '#8b5cf6' :
                                          variant.styleId === 'emotion' ? '#f97316' : '#6b7280'
                                      }}
                                    >
                                      {variant.styleName}
                                    </Badge>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">{variant.title}</p>
                                      <div className="mt-2 flex gap-2 text-xs text-gray-500">
                                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                                          冲突：{variant.conflict}
                                        </span>
                                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                                          情绪：{variant.emotion}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* 步骤4: 素材上传 */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-purple-600" />
                    第4步：上传宣传素材
                  </CardTitle>
                  <CardDescription>
                    根据你想要宣传的内容上传相关素材，AI将分析素材并融入脚本创作
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 素材上传指南 */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-600" />
                      建议上传的素材类型
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">📦</span>
                        <div>
                          <span className="font-medium">产品展示</span>
                          <p className="text-xs text-gray-500">产品包装、外观细节、多角度展示</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-lg">✨</span>
                        <div>
                          <span className="font-medium">使用效果</span>
                          <p className="text-xs text-gray-500">使用过程、效果对比、前后变化</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-lg">🏪</span>
                        <div>
                          <span className="font-medium">店铺/环境</span>
                          <p className="text-xs text-gray-500">门店外观、内部环境、氛围展示</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-lg">👤</span>
                        <div>
                          <span className="font-medium">人物素材</span>
                          <p className="text-xs text-gray-500">人设展示、口播视频、剧情片段</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      💡 提示：上传的素材会在脚本中智能标注使用位置，帮助AI理解你的宣传重点
                    </p>
                  </div>

                  {/* 上传区域 */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-sm text-gray-600 mb-2">
                      点击或拖拽文件上传
                    </p>
                    <p className="text-xs text-gray-400 mb-4">
                      支持图片（JPG/PNG）和视频（MP4/MOV）格式
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

                  {/* 已上传素材 */}
                  {materials.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">已上传素材 ({materials.length}个)</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMaterials([])}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          清空
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {materials.map((mat, index) => (
                          <div key={mat.id} className="relative group">
                            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border">
                              {mat.type === "image" ? (
                                <img src={mat.url} alt={mat.description || ""} className="w-full h-full object-cover" />
                              ) : (
                                <video src={mat.url} className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMaterials(prev => prev.filter(m => m.id !== mat.id));
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              素材 {index + 1}: {mat.type === 'image' ? '图片' : '视频'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 素材分析说明 */}
                  {materials.length > 0 && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        AI将分析你的素材并在脚本中标注使用位置
                      </p>
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
                        分析素材并生成脚本中...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        {materials.length > 0 ? '分析素材并生成脚本' : '生成脚本（无素材）'}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 步骤5: 脚本生成 */}
          {currentStep === 5 && (
            <div className="space-y-6">
              {/* 素材分析结果 */}
              {materialAnalysis.length > 0 && (
                <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <span className="text-green-600">📊</span> 素材分析结果
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {materialAnalysis.map((mat) => (
                      <div key={mat.index} className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            素材{mat.index} · {mat.type}
                          </Badge>
                          {mat.suggestedScene && (
                            <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200">
                              建议场景：{mat.suggestedScene}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{mat.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    第5步：脚本确认
                  </CardTitle>
                  <CardDescription>
                    查看生成的脚本，脚本已根据你的素材和宣传重点进行定制
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {script && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{script.title}</h3>
                          <p className="text-sm text-gray-500">人设：{script.persona || '根据商户类型自动生成'}</p>
                        </div>
                        <Badge className="text-lg px-3 py-1">{script.duration}秒</Badge>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 bg-purple-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <span>🎬</span> 开头3秒钩子
                              {script.opening_hook?.materialRef && (
                                <Badge variant="outline" className="text-xs">
                                  使用：{script.opening_hook.materialRef}
                                </Badge>
                              )}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {script.opening_hook?.visual}
                          </p>
                          <p className="text-sm mt-2 italic text-purple-700 dark:text-purple-300">
                            "{script.opening_hook?.script}"
                          </p>
                        </div>

                        <div className="p-4 bg-pink-50 dark:bg-gray-800 rounded-lg">
                          <h4 className="font-medium mb-3">📝 中间内容</h4>
                          {script.middle_content?.map((section: any, i: number) => (
                            <div key={i} className="mb-4 pb-4 border-b border-pink-200 dark:border-pink-800 last:border-0 last:mb-0 last:pb-0">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-medium text-sm text-pink-600">{section.section}</p>
                                {section.materialRef && (
                                  <Badge variant="outline" className="text-xs">
                                    使用：{section.materialRef}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{section.visual}</p>
                              <p className="text-sm mt-1 italic text-gray-700 dark:text-gray-300">"{section.script}"</p>
                            </div>
                          ))}
                        </div>

                        <div className="p-4 bg-orange-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <span>🎯</span> 结尾引导
                              {script.ending_guide?.materialRef && (
                                <Badge variant="outline" className="text-xs">
                                  使用：{script.ending_guide.materialRef}
                                </Badge>
                              )}
                            </h4>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {script.ending_guide?.visual}
                          </p>
                          <p className="text-sm mt-2 italic text-orange-700 dark:text-orange-300">
                            "{script.ending_guide?.cta}"
                          </p>
                        </div>
                      </div>

                      {/* 素材使用总览 */}
                      {script.materialUsagePlan && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-medium">📋 素材使用总览：</span>
                            {script.materialUsagePlan}
                          </p>
                        </div>
                      )}

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
            </div>
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
