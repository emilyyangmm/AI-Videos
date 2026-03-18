"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Target, Sparkles, Lightbulb, Upload, FileText, Video, 
  CheckCircle2, Loader2, ChevronRight, RefreshCw,
  Play, Download, Trash2, Plus, Clock
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
  { id: 1, title: "锁定赛道", icon: Target, description: "分析行业与目标人群" },
  { id: 2, title: "爆款词根", icon: Sparkles, description: "生成词根组合推荐" },
  { id: 3, title: "爆款选题", icon: Lightbulb, description: "生成爆款选题方案" },
  { id: 4, title: "素材上传", icon: Upload, description: "上传相关素材" },
  { id: 5, title: "脚本生成", icon: FileText, description: "生成逐镜脚本" },
  { id: 6, title: "视频生成", icon: Video, description: "AI生成视频" },
];

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [project, setProject] = useState<Project | null>(null);
  const [industry, setIndustry] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 各步骤数据
  const [industryAnalysis, setIndustryAnalysis] = useState<any>(null);
  const [wordRoots, setWordRoots] = useState<WordRoot[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [videos, setVideos] = useState<any[]>([]);

  // 创建项目并开始
  const handleStartProject = async () => {
    if (!industry.trim()) {
      toast.error("请输入行业/赛道");
      return;
    }

    setLoading(true);
    try {
      // 创建项目
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry }),
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
        setIndustryAnalysis(data.analysis);
        setCurrentStep(2);
        toast.success("赛道分析完成！");
        
        // 自动生成词根组合
        await generateWordRoots(projectId, data.analysis);
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

  // Veo 视频生成状态
  const [veoOperations, setVeoOperations] = useState<Map<string, { status: string; progress: number; videoUrl?: string }>>(new Map());
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 提交 Veo 视频生成任务
  const generateVideos = async () => {
    if (!project || !script) return;

    setLoading(true);
    try {
      // 将分镜转换为Veo提示词
      const shots = script.shot_list?.flatMap((scene: any) => 
        scene.shots.map((shot: any) => ({
          ...shot,
          duration: parseInt(shot.duration) || 8,
          veoPrompt: `${shot.visual}, ${scene.colorTone} tone, professional camera movement, cinematic quality`,
        }))
      ) || [];

      if (shots.length === 0) {
        toast.error("没有可生成的分镜");
        return;
      }

      // 为每个分镜提交任务
      const newOperations = new Map(veoOperations);
      
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        
        const res = await fetch("/api/veo/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            prompt: shot.veoPrompt,
            duration: Math.min(shot.duration, 8), // Veo最大支持8秒
            aspectRatio: "16:9",
            shotIndex: i,
          }),
        });
        
        const data = await res.json();
        
        if (data.success && data.operation_name) {
          newOperations.set(data.operation_name, {
            status: "processing",
            progress: 5,
          });
          
          // 开始轮询
          startPolling(data.operation_name, i);
        }
      }
      
      setVeoOperations(newOperations);
      setCurrentStep(6);
      toast.success(`已提交 ${shots.length} 个视频生成任务`);
    } catch (error) {
      toast.error("视频生成失败");
    } finally {
      setLoading(false);
    }
  };

  // 轮询任务状态
  const startPolling = (operationName: string, shotIndex: number) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/veo/generate?operation_name=${encodeURIComponent(operationName)}`);
        const data = await res.json();
        
        setVeoOperations(prev => {
          const newMap = new Map(prev);
          const current = newMap.get(operationName) || { status: "processing", progress: 5 };
          
          if (data.done) {
            if (data.success) {
              newMap.set(operationName, {
                status: "completed",
                progress: 100,
                videoUrl: data.video_url || data.gcs_uri,
              });
              
              // 添加到视频列表
              setVideos(v => [...v, {
                shotIndex,
                operationName,
                videoUrl: data.video_url || data.gcs_uri,
                success: true,
              }]);
              
              toast.success(`分镜 ${shotIndex + 1} 视频生成完成`);
            } else {
              newMap.set(operationName, {
                status: "failed",
                progress: 0,
              });
              toast.error(`分镜 ${shotIndex + 1} 生成失败: ${data.error}`);
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
          {/* 步骤1: 锁定赛道 */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  第1步：锁定赛道
                </CardTitle>
                <CardDescription>
                  输入您的行业/赛道，系统将分析目标人群特征和变现方式
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">您的行业/领域是什么？</label>
                  <Input
                    placeholder="例如：职场、教育、美妆、母婴、健身、美食、情感、科技..."
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleStartProject()}
                    className="text-lg"
                  />
                </div>
                
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
                    "开始分析"
                  )}
                </Button>

                {industryAnalysis && (
                  <div className="mt-6 space-y-4">
                    <h3 className="font-semibold text-lg">📊 赛道分析结果</h3>
                    
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
                  </div>
                )}
              </CardContent>
            </Card>
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

                    <Button
                      onClick={generateVideos}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          生成视频中...
                        </>
                      ) : (
                        <>
                          <Video className="w-4 h-4 mr-2" />
                          生成视频
                        </>
                      )}
                    </Button>
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
                  <Video className="w-5 h-5 text-purple-600" />
                  第6步：视频生成 (Google Veo 3.1)
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
                          <span className="font-medium">分镜 {index + 1}</span>
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
                              分镜 {video.shotIndex + 1}
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
