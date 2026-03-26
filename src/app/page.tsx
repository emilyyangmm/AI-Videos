"use client";
import React, { useState } from 'react';

export default function Home() {
  const [industry, setIndustry] = useState('灯具');
  const [topics, setTopics] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/topics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry })
      });
      const data = await res.json();
      setTopics(data.topics || []);
      setSelectedIdx(null);
    } catch (e) {
      console.error("生成失败", e);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-10 space-y-8 bg-gray-50 min-h-screen">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">AI 短视频爆款助手</h1>
        
        <div className="flex gap-4 mb-8">
          <input 
            value={industry} 
            onChange={e => setIndustry(e.target.value)} 
            className="border p-3 flex-1 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" 
            placeholder="输入你的行业..."
          />
          <button onClick={fetchTopics} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95">
            {loading ? '生成中...' : '生成 8 个选题'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {topics.map((t, i) => (
            <div 
              key={i} 
              onClick={() => setSelectedIdx(i)}
              className={`p-5 border-2 rounded-2xl cursor-pointer transition-all ${
                selectedIdx === i ? 'border-blue-600 bg-blue-50 shadow-md scale-[1.02]' : 'border-gray-100 bg-white hover:border-blue-200'
              }`}
            >
              <div className="font-bold text-lg text-gray-800 mb-2">{t.title}</div>
              <div className="text-sm text-gray-500 line-clamp-2">{t.reason}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-gray-100 rounded-2xl border border-dashed border-gray-300">
          <label className="block font-bold text-gray-700 mb-3">自定义爆款元素 (按回车添加标签):</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag, i) => (
              <span key={i} className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs flex items-center shadow-sm">
                #{tag}
                <button onClick={() => setTags(tags.filter((_, idx) => idx !== i))} className="ml-2 hover:text-red-200">×</button>
              </span>
            ))}
          </div>
          <input 
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if(e.key === 'Enter' && tagInput.trim()) { setTags([...tags, tagInput.trim()]); setTagInput(''); } }}
            className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
            placeholder="添加爆款关键词，如：源头工厂、极限测试..."
          />
        </div>
      </div>
    </div>
  );
}
