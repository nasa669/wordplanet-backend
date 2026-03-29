import { serve } from "https://deno.land/std@0.210.0/http/server.ts";

// 用内存模拟数据库（不再需要 Deno KV）
const memoryStore = new Map();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  // 注册
  if (path === "/api/register" && req.method === "POST") {
    const { username, password } = await req.json();
    if (memoryStore.has(`user:${username}`)) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
    memoryStore.set(`user:${username}`, { password });
    memoryStore.set(`userData:${username}`, {
      knownWords: { CET4: [], CET6: [], 考研: [] },
      dailyGoal: { CET4: 10, CET6: 10, 考研: 10 },
      dailyLearned: { CET4: 0, CET6: 0, 考研: 0 },
      lastStudyDate: new Date().toDateString(),
    });
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // 登录
  if (path === "/api/login" && req.method === "POST") {
    const { username, password } = await req.json();
    const user = memoryStore.get(`user:${username}`);
    if (!user || user.password !== password) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // 保存已学单词
  if (path === "/api/save-known" && req.method === "POST") {
    const { username, word, category } = await req.json();
    const userData = memoryStore.get(`userData:${username}`);
    if (!userData) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
    if (!userData.knownWords[category].includes(word)) {
      userData.knownWords[category].push(word);
      memoryStore.set(`userData:${username}`, userData);
    }
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // 获取已学单词
  if (path === "/api/get-known" && req.method === "GET") {
    const username = url.searchParams.get("username");
    const category = url.searchParams.get("category");
    const userData = memoryStore.get(`userData:${username}`);
    if (!userData) {
      return new Response(JSON.stringify([]), { headers });
    }
    return new Response(JSON.stringify(userData.knownWords[category] || []), { headers });
  }

  // 设置每日目标
  if (path === "/api/set-daily-goal" && req.method === "POST") {
    const { username, category, goal } = await req.json();
    const userData = memoryStore.get(`userData:${username}`);
    if (!userData) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
    userData.dailyGoal[category] = goal;
    memoryStore.set(`userData:${username}`, userData);
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // 获取每日目标
  if (path === "/api/get-daily-goal" && req.method === "GET") {
    const username = url.searchParams.get("username");
    const category = url.searchParams.get("category");
    const userData = memoryStore.get(`userData:${username}`);
    if (!userData) {
      return new Response(JSON.stringify({ goal: 10, learned: 0 }), { headers });
    }
    return new Response(JSON.stringify({
      goal: userData.dailyGoal[category] || 10,
      learned: userData.dailyLearned[category] || 0,
    }), { headers });
  }

  // 更新学习进度
  if (path === "/api/update-daily-learned" && req.method === "POST") {
    const { username, category, learned } = await req.json();
    const userData = memoryStore.get(`userData:${username}`);
    if (!userData) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
    userData.dailyLearned[category] = learned;
    memoryStore.set(`userData:${username}`, userData);
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // 保存错题
  if (path === "/api/save-wrong" && req.method === "POST") {
    const { username, word, definition, category } = await req.json();
    const id = crypto.randomUUID();
    memoryStore.set(`wrongNote:${username}:${id}`, {
      word,
      definition,
      category,
      timestamp: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // 获取错题
  if (path === "/api/get-wrong" && req.method === "GET") {
    const username = url.searchParams.get("username");
    const wrongList = [];
    for (const [key, value] of memoryStore.entries()) {
      if (key.startsWith(`wrongNote:${username}:`)) {
        wrongList.push(value);
      }
    }
    return new Response(JSON.stringify(wrongList), { headers });
  }

  // 游戏单词
  if (path === "/api/get-game-words" && req.method === "GET") {
    const username = url.searchParams.get("username");
    const category = url.searchParams.get("category");
    const userData = memoryStore.get(`userData:${username}`);
    if (!userData) {
      return new Response(JSON.stringify([]), { headers });
    }
    const knownWords = userData.knownWords[category] || [];
    return new Response(JSON.stringify(knownWords.slice(0, 10)), { headers });
  }

  return new Response("Not found", { status: 404, headers: corsHeaders });
});
