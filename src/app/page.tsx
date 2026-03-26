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
  CheckCircle2, Loader2, ChevronRight, ChevronLeft, RefreshCw,
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
  shotIndex?: number;  // 关联的分镜索引
  category?: string;   // 素材分类（如：柜台场景、产品展示等）
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
  // 新增口播脚本字段
  script?: string;
  wordCount?: number;
  targetWordCount?: { min: number; max: number };
  estimatedDuration?: number;
  openingHook?: string;
  mainContent?: string;
  closingCTA?: string;
  usedHooks?: string[];
}

const STEPS = [
  { id: 1, title: "场景设定", icon: Target, description: "输入行业和视频目的" },
  { id: 2, title: "脚本类型", icon: FileText, description: "选择口播脚本类型" },
  { id: 3, title: "爆款元素", icon: Sparkles, description: "选择爆款元素和钩子词根" },
  { id: 4, title: "爆款选题", icon: Lightbulb, description: "生成8个爆款选题" },
  { id: 5, title: "口播脚本", icon: FileText, description: "生成口播文案" },
  { id: 6, title: "数字人生成", icon: Video, description: "生成口播数字人视频" },
];

// 维度一：商户类型配置
const MERCHANT_TYPES = [
  {
    id: "ecommerce",
    title: "电商卖家",
    icon: "🛍️",
    examples: "淘宝/抖音小店、跨境电商",
    goal: "直接转化，展示产品卖点",
    recommendedDuration: [30, 45],
    recommendedElements: "成本+人群+最差",
    style: "快节奏、直击痛点、强转化导向"
  },
  {
    id: "local_business",
    title: "实体店商家",
    icon: "🏪",
    examples: "餐饮、美业、教育、本地生活",
    goal: "引流到店，展示环境/服务",
    recommendedDuration: [30, 45],
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

// 脚本类型（步骤2选择）
const SCRIPT_TYPES = [
  {
    id: "teach",
    title: "教知识",
    icon: "📚",
    description: "问题→解决方案→效果",
    structure: "先抛出痛点，再给出方法，最后展示效果",
    example: "3个Excel技巧让你效率翻倍"
  },
  {
    id: "show",
    title: "晒过程",
    icon: "🎬",
    description: "场景→过程→结果",
    structure: "展示真实场景，记录操作过程，呈现最终结果",
    example: "带你看我的一天是怎么过的"
  },
  {
    id: "opinion",
    title: "聊观点",
    icon: "💬",
    description: "现象→观点→共鸣",
    structure: "描述社会现象，表达鲜明观点，引发情感共鸣",
    example: "为什么年轻人越来越不想结婚了？"
  },
  {
    id: "story",
    title: "讲故事",
    icon: "📖",
    description: "冲突→转折→结局",
    structure: "设置戏剧冲突，制造意外转折，给出圆满结局",
    example: "我被客户骂了3小时，结果反转了"
  }
];

// 8大爆款元素（步骤3选择）
const VIRAL_ELEMENTS = [
  {
    id: "cost",
    title: "成本维度",
    icon: "💰",
    coreLogic: "花小钱办大事，满足性价比心理",
    hooks: ["花小钱装大杯", "省时省钱省力", "平替", "白嫖", "一招搞定", "9.9元"],
    example: "9.9元改造出租屋"
  },
  {
    id: "crowd",
    title: "人群维度",
    icon: "👥",
    coreLogic: "锁定特定群体，引发共情归属",
    hooks: ["宝妈", "程序员", "打工人", "小个子", "巨蟹座", "处女座"],
    example: "宝妈必看的3个带娃神器"
  },
  {
    id: "curiosity",
    title: "猎奇维度",
    icon: "🔍",
    coreLogic: "反常识冷知识，打破认知惯性",
    hooks: ["反常识", "万万没想到", "揭秘", "黑科技", "冷知识", "据说"],
    example: "在葡萄上做医美？"
  },
  {
    id: "contrast",
    title: "反差维度",
    icon: "⚡",
    coreLogic: "制造戏剧冲突，产生记忆点",
    hooks: ["身份错位", "场景反差", "没想到你是这样的", "居然", "竟然"],
    example: "在菜市场卖奢侈品"
  },
  {
    id: "worst",
    title: "最差元素",
    icon: "👎",
    coreLogic: "利用负面情绪，引发讨论吐槽",
    hooks: ["最丢脸", "最没面子", "避坑", "千万别买", "全网最低分"],
    example: "大众点评评分最差的店，到底有多难吃？"
  },
  {
    id: "authority",
    title: "头牌效应",
    icon: "👑",
    coreLogic: "借势名人权威，建立信任认知",
    hooks: ["明星同款", "大佬揭秘", "爱马仕工艺", "CCTV报道", "首富思维"],
    example: "揭秘爱马仕的百年工艺"
  },
  {
    id: "nostalgia",
    title: "怀旧元素",
    icon: "📼",
    coreLogic: "激活集体记忆，触发情感共鸣",
    hooks: ["童年回忆", "20年前", "小时候", "老味道", "经典复刻", "爷青回"],
    example: "复刻小学门口的5毛钱零食"
  },
  {
    id: "hormone",
    title: "荷尔蒙驱动",
    icon: "💕",
    coreLogic: "满足情感好奇，驱动社交话题",
    hooks: ["找对象", "脱单", "渣男鉴别", "分手", "前任", "夫妻关系"],
    example: "找对象时，如何一眼识别PUA？"
  }
];

// 动作风格（步骤6选择）
const MOTION_STYLES = [
  {
    id: "enthusiastic",
    title: "热情推荐",
    icon: "🎉",
    description: "自信走向镜头，举手展示产品，充满活力",
    prompt: "Enthusiastically walking towards camera, raising hand to show product, energetic smile"
  },
  {
    id: "professional",
    title: "专业讲解",
    icon: "👔",
    description: "保持稳定姿态，手势配合讲解，专注认真",
    prompt: "Stable posture, hand gestures for explanation, focused and serious expression"
  },
  {
    id: "friendly",
    title: "亲切聊天",
    icon: "😊",
    description: "自然放松肢体，轻微点头，亲切微笑",
    prompt: "Natural relaxed body language, slight nodding, friendly smile"
  },
  {
    id: "surprise",
    title: "惊喜揭秘",
    icon: "😲",
    description: "夸张惊讶表情，配合快速手势，制造悬念",
    prompt: "Exaggerated surprised expression, quick hand gestures, creating suspense"
  },
  {
    id: "authoritative",
    title: "权威背书",
    icon: "🏛️",
    description: "挺拔自信站姿，稳重手势，严肃专业",
    prompt: "Confident upright posture, steady gestures, serious and professional expression"
  }
];

// 豆包语音合成模型2.0音色列表（字符版，用户实际开通的音色）
const VOICE_OPTIONS = [
  // 通用场景音色（后缀 _uranus_bigtts）
  { id: "zh_female_vv_uranus_bigtts", name: "vivi 2.0", desc: "通用女声，适合多种场景" },
  { id: "zh_female_xiaohe_uranus_bigtts", name: "小何", desc: "通用女声，自然亲切" },
  { id: "zh_male_m191_uranus_bigtts", name: "云舟", desc: "成熟男声，适合品牌背书" },
  { id: "zh_male_taocheng_uranus_bigtts", name: "小天", desc: "阳光男声，适合知识博主" },
  { id: "en_male_tim_uranus_bigtts", name: "Tim", desc: "英文男声，适合英文内容" },
  // 角色扮演音色（后缀 _tob）
  { id: "saturn_zh_female_cancan_tob", name: "知性灿灿", desc: "角色扮演，知性优雅" },
  { id: "saturn_zh_female_keainvsheng_tob", name: "可爱女生", desc: "角色扮演，活泼可爱" },
  { id: "saturn_zh_female_tiaopigongzhu_tob", name: "调皮公主", desc: "角色扮演，俏皮灵动" },
  { id: "saturn_zh_male_shuanglangshaonian_tob", name: "爽朗少年", desc: "角色扮演，阳光帅气" },
  { id: "saturn_zh_male_tiancaitongzhuo_tob", name: "天才同桌", desc: "角色扮演，邻家少年" },
];

// 时长对应字数
const DURATION_WORD_COUNT: Record<number, { min: number; max: number }> = {
  30: { min: 110, max: 140 },
  45: { min: 170, max: 210 },
  60: { min: 230, max: 270 }
};

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 步骤1：场景设定（新流程）
  const [userIndustry, setUserIndustry] = useState<string>(""); // 用户输入的行业
  const [videoGoal, setVideoGoal] = useState<string>(""); // 视频目的
  const [videoDuration, setVideoDuration] = useState<number>(30); // 视频时长
  const [recommendedDuration, setRecommendedDuration] = useState<number>(30); // 推荐时长
  
  // 新流程状态
  const [scriptType, setScriptType] = useState<string | null>(null); // 脚本类型
  const [selectedElements, setSelectedElements] = useState<string[]>([]); // 选中的爆款元素
  const [selectedHooks, setSelectedHooks] = useState<string[]>([]); // 用户勾选的钩子词根
  const [portraitImage, setPortraitImage] = useState<string | null>(null); // 人像图片
  const [motionStyle, setMotionStyle] = useState<string>("friendly"); // 动作风格
  const [voiceStyle, setVoiceStyle] = useState<string>("zh_female_vv_uranus_bigtts"); // 声音风格
  const [digitalHumanTaskId, setDigitalHumanTaskId] = useState<string | null>(null); // 数字人任务ID
  const [digitalHumanVideo, setDigitalHumanVideo] = useState<string | null>(null); // 生成的数字人视频
  
  // 各步骤数据
  const [industryAnalysis, setIndustryAnalysis] = useState<any>(null);
  const [wordRoots, setWordRoots] = useState<WordRoot[]>([]);
  const [wordRootAnalysis, setWordRootAnalysis] = useState<any>(null); // 词根分析过程
  const [generatingWordRoots, setGeneratingWordRoots] = useState(false); // 词根生成中状态
  const [topics, setTopics] = useState<Topic[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9"); // 视频宽高比
  const [mergedVideo, setMergedVideo] = useState<string | null>(null); // 合成后的视频URL
  
  // 追踪已访问的步骤，用于支持返回调整
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([1]));
  
  // 更新当前步骤时记录已访问
  const setCurrentStepWithTrack = (step: number) => {
    setCurrentStep(step);
    setVisitedSteps(prev => new Set([...prev, step]));
  };
  
  // 根据输入自动推荐时长
  const getRecommendedDuration = (industry: string, goal: string): number => {
    const goalLower = goal.toLowerCase();
    const industryLower = industry.toLowerCase();
    
    // 根据目的推荐
    if (goalLower.includes("卖") || goalLower.includes("转化") || goalLower.includes("到店")) {
      return 30; // 转化类推荐短视频
    }
    if (goalLower.includes("涨粉") || goalLower.includes("品牌") || goalLower.includes("认知")) {
      return 45; // 品牌类推荐长视频
    }
    if (goalLower.includes("引流")) {
      return 30; // 引流类推荐中等
    }
    
    // 根据行业推荐
    if (industryLower.includes("美妆") || industryLower.includes("穿搭") || industryLower.includes("美食")) {
      return 30; // 视觉类短
    }
    if (industryLower.includes("教育") || industryLower.includes("知识") || industryLower.includes("职场")) {
      return 45; // 知识类长
    }
    
    return 30; // 默认30秒
  };
  
  // 监听输入变化，自动更新推荐时长
  useEffect(() => {
    if (userIndustry && videoGoal) {
      const recommended = getRecommendedDuration(userIndustry, videoGoal);
      setRecommendedDuration(recommended);
      setVideoDuration(recommended);
    }
  }, [userIndustry, videoGoal]);

  // 生成爆款选题
  // 生成爆款选题
  const generateTopics = async () => {
    if (selectedElements.length === 0) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/topics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIndustry,
          videoGoal,
          viralElements: selectedElements,
          selectedHooks,
          videoDuration,
          count: 8
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setTopics(data.topics.map((t: any, i: number) => ({ ...t, id: t.id || `topic_${i}`, is_selected: false })));
        toast.success("已生成8个爆款选题！");
      } else {
        toast.error(data.error || "生成选题失败");
      }
    } catch (error) {
      toast.error("生成选题失败");
    } finally {
      setLoading(false);
    }
  };

  // 换一批选题
  const refreshTopics = async () => {
    generateTopics();
  };

  // 选择选题
  const selectTopic = async (topicId: string) => {
    setTopics(prev => prev.map(t => ({
      ...t,
      is_selected: t.id === topicId,
    })));
  };

  // 生成口播脚本
  const generateScript = async () => {
    if (!topics.some((t: any) => t.is_selected)) return;
    
    setLoading(true);
    try {
      const selectedTopic = topics.find((t: any) => t.is_selected);
      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIndustry,
          videoGoal,
          topic: selectedTopic,
          duration: videoDuration,
          scriptType,
          viralElements: selectedElements,
          selectedHooks
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        setScript(data.script);
        toast.success("脚本生成成功！");
      } else {
        toast.error(data.error || "脚本生成失败");
      }
    } catch (error) {
      toast.error("生成脚本失败");
    } finally {
      setLoading(false);
    }
  };

  // 轮询数字人视频状态
  const pollDigitalHumanStatus = async (taskId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/digital-human/status?taskId=${taskId}`);
        const data = await res.json();
        
        if (data.status === "completed" && data.video_url) {
          clearInterval(pollInterval);
          setDigitalHumanVideo(data.video_url);
          toast.success("数字人视频生成完成！");
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          toast.error("数字人视频生成失败");
        }
      } catch (error) {
        clearInterval(pollInterval);
        toast.error("查询状态失败");
      }
    }, 5000);
  };

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
                  onClick={() => visitedSteps.has(step.id) && setCurrentStep(step.id)}
                  disabled={!visitedSteps.has(step.id)}
                  className={`flex flex-col items-center ${
                    visitedSteps.has(step.id) ? "cursor-pointer" : "cursor-not-allowed opacity-50"
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    第1步：场景设定
                  </CardTitle>
                  <CardDescription>
                    告诉我们你的行业和视频目的，系统会为你推荐最合适的内容策略
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 行业输入 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <span className="text-purple-600">🏢</span> 你的行业领域
                    </label>
                    <Input
                      placeholder="例如：美妆、宠物、职场、美食、教育..."
                      value={userIndustry}
                      onChange={(e) => setUserIndustry(e.target.value)}
                      className="text-lg py-3"
                    />
                    <p className="text-xs text-gray-500">
                      输入你的具体行业，越具体越好
                    </p>
                  </div>

                  {/* 视频目的输入 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <span className="text-pink-600">🎯</span> 这条视频的目的是什么
                    </label>
                    <Input
                      placeholder="例如：引流到店、卖产品、涨粉、建立品牌认知..."
                      value={videoGoal}
                      onChange={(e) => setVideoGoal(e.target.value)}
                      className="text-lg py-3"
                    />
                    <p className="text-xs text-gray-500">
                      明确目的，让AI生成更精准的内容
                    </p>
                  </div>

                  {/* 时长选择 */}
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">视频时长</span>
                      {userIndustry && videoGoal && (
                        <Badge variant="outline" className="text-purple-600 border-purple-600">
                          AI推荐：{recommendedDuration}秒
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-3">
                      {[30, 45, 60].map((duration) => (
                        <button
                          key={duration}
                          onClick={() => setVideoDuration(duration)}
                          className={`flex-1 py-3 rounded-lg border-2 transition-all ${
                            videoDuration === duration
                              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30"
                              : "border-gray-200 hover:border-purple-300"
                          }`}
                        >
                          <div className="text-lg font-bold">{duration}秒</div>
                          <div className="text-xs text-gray-500">
                            约 {DURATION_WORD_COUNT[duration].min}-{DURATION_WORD_COUNT[duration].max} 字
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 开始按钮 */}
                  <Button
                    onClick={() => {
                      if (!userIndustry.trim() || !videoGoal.trim()) {
                        toast.error("请填写行业和视频目的");
                        return;
                      }
                      setCurrentStepWithTrack(2);
                    }}
                    disabled={!userIndustry.trim() || !videoGoal.trim()}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    下一步：选择脚本类型
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 步骤2: 脚本类型选择 */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    第2步：选择脚本类型
                  </CardTitle>
                  <CardDescription>
                    选择你想要的内容结构，AI会根据类型生成对应的口播脚本
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SCRIPT_TYPES.map((type) => (
                      <div
                        key={type.id}
                        onClick={() => setScriptType(type.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          scriptType === type.id
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                            : "border-gray-200 hover:border-purple-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{type.icon}</span>
                          <span className="text-lg font-semibold">{type.title}</span>
                          {scriptType === type.id && <CheckCircle2 className="w-5 h-5 text-purple-600 ml-auto" />}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{type.description}</p>
                        <div className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 p-2 rounded">
                          结构：{type.structure}
                        </div>
                        <div className="mt-2 text-xs text-purple-600">
                          示例：{type.example}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button variant="outline" onClick={() => setCurrentStepWithTrack(1)} className="flex-1">
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      返回场景设定
                    </Button>
                    <Button 
                      onClick={() => setCurrentStepWithTrack(3)} 
                      disabled={!scriptType}
                      className="flex-1"
                    >
                      下一步：选择爆款元素
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 步骤3: 爆款元素选择 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    第3步：选择爆款元素和钩子词根
                  </CardTitle>
                  <CardDescription>
                    建议选择2个元素，系统会组合使用对应钩子词根生成吸睛内容
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 爆款元素选择 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">选择爆款元素（建议选2个）</label>
                      <span className="text-sm text-gray-500">已选 {selectedElements.length}/3</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {VIRAL_ELEMENTS.map((element) => (
                        <div
                          key={element.id}
                          onClick={() => {
                            if (selectedElements.includes(element.id)) {
                              setSelectedElements(selectedElements.filter(e => e !== element.id));
                              // 移除该元素的钩子词根
                              const hooksToRemove = element.hooks;
                              setSelectedHooks(prev => prev.filter(h => !hooksToRemove.includes(h)));
                            } else if (selectedElements.length < 3) {
                              setSelectedElements([...selectedElements, element.id]);
                              // 默认全选该元素的钩子词根
                              setSelectedHooks(prev => [...new Set([...prev, ...element.hooks])]);
                            }
                          }}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedElements.includes(element.id)
                              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                              : "border-gray-200 hover:border-purple-300"
                          } ${selectedElements.length >= 3 && !selectedElements.includes(element.id) ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{element.icon}</span>
                            <span className="font-semibold text-sm">{element.title}</span>
                            {selectedElements.includes(element.id) && <CheckCircle2 className="w-4 h-4 text-purple-600 ml-auto" />}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{element.coreLogic}</p>
                          {/* 显示钩子词根标签 */}
                          <div className="flex flex-wrap gap-1">
                            {element.hooks.map((hook, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{hook}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 钩子词根选择区域 */}
                  {selectedElements.length > 0 && (
                    <div className="space-y-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">勾选要使用的钩子词根</label>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // 全选所有已选元素的钩子
                              const allHooks = selectedElements.flatMap(el => 
                                VIRAL_ELEMENTS.find(e => e.id === el)?.hooks || []
                              );
                              setSelectedHooks([...new Set(allHooks)]);
                            }}
                          >
                            全选
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedHooks([])}
                          >
                            清空
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">默认全选，可取消不想用的词根。开头第一句会使用选中的词根。</p>
                      
                      {selectedElements.map((elementId) => {
                        const element = VIRAL_ELEMENTS.find(e => e.id === elementId);
                        if (!element) return null;
                        return (
                          <div key={elementId} className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                              <span>{element.icon}</span>
                              <span>{element.title}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {element.hooks.map((hook, i) => (
                                <Badge
                                  key={`${elementId}-${i}`}
                                  variant={selectedHooks.includes(hook) ? "default" : "outline"}
                                  className={`cursor-pointer transition-all ${
                                    selectedHooks.includes(hook)
                                      ? "bg-purple-600 hover:bg-purple-700"
                                      : "hover:bg-purple-100"
                                  }`}
                                  onClick={() => {
                                    if (selectedHooks.includes(hook)) {
                                      setSelectedHooks(selectedHooks.filter(h => h !== hook));
                                    } else {
                                      setSelectedHooks([...selectedHooks, hook]);
                                    }
                                  }}
                                >
                                  {hook}
                                  {selectedHooks.includes(hook) && (
                                    <CheckCircle2 className="w-3 h-3 ml-1" />
                                  )}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 已选钩子词根汇总 */}
                  {selectedHooks.length > 0 && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-sm text-green-700 font-medium mb-2">
                        已勾选 {selectedHooks.length} 个钩子词根
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedHooks.map((hook, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-white">{hook}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <Button variant="outline" onClick={() => setCurrentStepWithTrack(2)} className="flex-1">
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      返回脚本类型
                    </Button>
                    <Button 
                      onClick={() => setCurrentStepWithTrack(4)} 
                      disabled={selectedElements.length === 0 || selectedHooks.length === 0}
                      className="flex-1"
                    >
                      下一步：生成选题
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 步骤4: 爆款选题 */}
          {currentStep === 4 && (
            <div className="space-y-6 relative">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-purple-600" />
                    第4步：选择爆款选题
                  </CardTitle>
                  <CardDescription>
                    基于你选择的爆款元素，AI为你生成8个爆款选题
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      已选元素：{selectedElements.map(el => 
                        VIRAL_ELEMENTS.find(e => e.id === el)?.title
                      ).join('、')}
                    </div>
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

                  {topics.length === 0 && (
                    <div className="text-center py-8">
                      <Button onClick={generateTopics} disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            生成8个爆款选题
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {topics.map((topic: any, topicIndex: number) => (
                      <div
                        key={topic.id}
                        onClick={() => selectTopic(topic.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          topic.is_selected
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                            : "border-gray-200 hover:border-purple-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge>选题 {topicIndex + 1}</Badge>
                          {topic.is_selected && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                        </div>
                        <h4 className="font-semibold mb-2">{topic.title}</h4>
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>💥 {topic.conflict_point || topic.conflictPoint}</p>
                          <p>🎭 {topic.emotion_hook || topic.emotionHook}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button variant="outline" onClick={() => setCurrentStepWithTrack(3)} className="flex-1">
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      返回元素选择
                    </Button>
                    <Button 
                      onClick={() => setCurrentStepWithTrack(5)} 
                      disabled={!topics.some((t: any) => t.is_selected)}
                      className="flex-1"
                    >
                      下一步：生成口播脚本
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 步骤5: 口播脚本 */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    第5步：口播脚本
                  </CardTitle>
                  <CardDescription>
                    根据时长生成口播文案，严格控制字数
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 字数进度条 */}
                  {script && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>字数进度</span>
                        <span>{script.wordCount || 0} / {script.targetWordCount?.min || 0}-{script.targetWordCount?.max || 0} 字</span>
                      </div>
                      <Progress 
                        value={((script.wordCount || 0) / (script.targetWordCount?.max || 200)) * 100} 
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>预估时长：{script.estimatedDuration}秒</span>
                        <span>目标时长：{videoDuration}秒</span>
                      </div>
                    </div>
                  )}

                  {/* 脚本内容 */}
                  {script ? (
                    <div className="space-y-4">
                      {/* 开头钩子 */}
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500">
                        <h4 className="font-medium text-red-700 mb-2">🎣 开头钩子（前3秒）</h4>
                        <p className="text-sm">{script.openingHook}</p>
                      </div>

                      {/* 中间内容 */}
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                        <h4 className="font-medium text-blue-700 mb-2">📝 中间内容</h4>
                        <p className="text-sm whitespace-pre-wrap">{script.mainContent}</p>
                      </div>

                      {/* 结尾引导 */}
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500">
                        <h4 className="font-medium text-green-700 mb-2">🎯 结尾行动号召</h4>
                        <p className="text-sm">{script.closingCTA}</p>
                      </div>

                      {/* 使用的钩子词根 */}
                      {script.usedHooks && script.usedHooks.length > 0 && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <p className="text-xs text-gray-500 mb-2">使用的钩子词根：</p>
                          <div className="flex flex-wrap gap-1">
                            {script.usedHooks.map((hook: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">{hook}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 完整脚本 */}
                      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <h4 className="font-medium mb-2">📄 完整脚本</h4>
                        <Textarea 
                          value={script.script}
                          onChange={(e) => {
                            const newScript = e.target.value;
                            setScript({
                              ...script,
                              script: newScript,
                              wordCount: newScript.length,
                              estimatedDuration: Math.ceil(newScript.length / 4.5)
                            });
                          }}
                          className="min-h-[200px]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Button onClick={generateScript} disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 mr-2" />
                            生成口播脚本
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <Button variant="outline" onClick={() => setCurrentStepWithTrack(4)} className="flex-1">
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      返回选题
                    </Button>
                    <Button variant="outline" onClick={generateScript} disabled={loading} className="flex-1">
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      重新生成
                    </Button>
                    <Button 
                      onClick={() => setCurrentStepWithTrack(6)} 
                      disabled={!script}
                      className="flex-1"
                    >
                      下一步：生成数字人视频
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 步骤6: 数字人生成 */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-purple-600" />
                    第6步：生成数字人视频
                  </CardTitle>
                  <CardDescription>
                    上传人像图片，选择声音和动作风格，生成口播数字人视频
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 人像上传 */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">👤 上传人像图片</label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      {portraitImage ? (
                        <div className="relative">
                          <img src={portraitImage} alt="人像" className="max-h-64 mx-auto rounded-lg" />
                          <Button 
                            variant="destructive" 
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => setPortraitImage(null)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">点击或拖拽上传人像图片</p>
                          <Input
                            type="file"
                            accept="image/*"
                            className="mt-2"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  setPortraitImage(ev.target?.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 声音选择 - 网格卡片样式 */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">🎵 选择声音风格</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {VOICE_OPTIONS.map((voice) => (
                        <div
                          key={voice.id}
                          onClick={() => setVoiceStyle(voice.id)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            voiceStyle === voice.id
                              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md"
                              : "border-gray-200 hover:border-purple-300 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{voice.id.includes("male") ? "👨" : "👩"}</span>
                            <span className="text-sm font-semibold">{voice.name}</span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">{voice.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 动作风格选择 */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">🎭 选择动作风格</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
                      {MOTION_STYLES.map((motion) => (
                        <div
                          key={motion.id}
                          onClick={() => setMotionStyle(motion.id)}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            motionStyle === motion.id
                              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                              : "border-gray-200 hover:border-purple-300"
                          }`}
                        >
                          <div className="text-xl mb-1">{motion.icon}</div>
                          <div className="text-sm font-medium">{motion.title}</div>
                          <div className="text-xs text-gray-500 mt-1">{motion.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 生成按钮 */}
                  <Button
                    onClick={async () => {
                      if (!portraitImage || !script?.script) {
                        toast.error("请先上传人像图片并生成脚本");
                        return;
                      }

                      setLoading(true);
                      try {
                        // 直接使用图片URL（测试模式下后端会替换为测试图片）
                        // 只有当后端关闭测试模式时，才需要上传图片获取公网URL
                        const publicImageUrl = portraitImage;

                        const res = await fetch("/api/digital-human/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            portraitImage: publicImageUrl,
                            script: script.script,
                            voiceStyle,
                            motionStyle,
                            aspectRatio
                          })
                        });

                        const data = await res.json();
                        if (data.success) {
                          setDigitalHumanTaskId(data.task_id);
                          toast.success("数字人视频生成任务已提交");
                          // 开始轮询状态
                          pollDigitalHumanStatus(data.task_id);
                        } else {
                          toast.error(data.error || "生成失败");
                        }
                      } catch (error) {
                        toast.error("生成失败");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading || !portraitImage || !script}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 mr-2" />
                        生成数字人视频
                      </>
                    )}
                  </Button>

                  {/* 生成结果 */}
                  {digitalHumanVideo && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        数字人视频生成完成
                      </h4>
                      <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden max-w-xs mx-auto">
                        <video src={digitalHumanVideo} controls className="w-full h-full" />
                      </div>
                      <div className="mt-3 flex gap-2 justify-center">
                        <a
                          href={digitalHumanVideo}
                          download
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Download className="w-4 h-4" />
                          下载视频
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <Button variant="outline" onClick={() => setCurrentStepWithTrack(5)} className="flex-1">
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      返回脚本
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
