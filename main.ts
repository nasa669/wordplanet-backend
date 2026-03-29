import { serve } from "https://deno.land/std@0.210.0/http/server.ts";
import { cors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
const kv = await Deno.openKv();

// 跨域配置
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  headers: ["Content-Type"],
};

serve(async (req) => {
  // 处理 OPTIONS 跨域预检
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors(corsOptions) });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const headers = { ...cors(corsOptions), "Content-Type": "application/json" };

  // ====================== 1. 用户模块 ======================
  // 注册
  if (path === "/api/register" && req.method === "POST") {
    const { username, password } = await req.json();
    // 检查用户名是否已存在
    const existingUser = await kv.get(["users", username]);
    if (existingUser.value) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
    // 保存用户
    await kv.set(["users", username], { username, password });
    // 初始化用户数据
    await kv.set(["userData", username], {
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
    const user = await kv.get(["users", username]);
    if (!user.value || user.value.password !== password) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // ====================== 2. 单词学习模块 ======================
  // 保存已学单词
  if (path === "/api/save-known" && req.method === "POST") {
    const { username, word, category } = await req.json();
    const userData = await kv.get(["userData", username]);
    if (!userData.value) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
    // 添加到已学单词（去重）
    if (!userData.value.knownWords[category].includes(word)) {
      userData.value.knownWords[category].push(word);
      await kv.set(["userData", username], userData.value);
    }
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // 获取已学单词
  if (path === "/api/get-known" && req.method === "GET") {
    const username = url.searchParams.get("username");
    const category = url.searchParams.get("category");
    const userData = await kv.get(["userData", username]);
    if (!userData.value) {
      return new Response(JSON.stringify([]), { headers });
    }
    return new Response(JSON.stringify(userData.value.knownWords[category] || []), { headers });
  }

  // 设置每日目标
  if (path === "/api/set-daily-goal" && req.method === "POST") {
    const { username, category, goal } = await req.json();
    const userData = await kv.get(["userData", username]);
    if (!userData.value) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
    userData.value.dailyGoal[category] = goal;
    await kv.set(["userData", username], userData.value);
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // 获取每日目标和进度
  if (path === "/api/get-daily-goal" && req.method === "GET") {
    const username = url.searchParams.get("username");
    const category = url.searchParams.get("category");
    const userData = await kv.get(["userData", username]);
    if (!userData.value) {
      return new Response(JSON.stringify({ goal: 10, learned: 0 }), { headers });
    }
    return new Response(JSON.stringify({
      goal: userData.value.dailyGoal[category] || 10,
      learned: userData.value.dailyLearned[category] || 0,
    }), { headers });
  }

  // 更新每日学习进度
  if (path === "/api/update-daily-learned" && req.method === "POST") {
    const { username, category, learned } = await req.json();
    const userData = await kv.get(["userData", username]);
    if (!userData.value) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
    userData.value.dailyLearned[category] = learned;
    await kv.set(["userData", username], userData.value);
    return new Response(JSON.stringify({ success: true }), { headers });
  }

  // ====================== 3. 错题集模块 ======================
  // 保存错题
  if (path === "/api/save-wrong" && req.method === "POST") {
    const { username, word, definition, category } = await req.json();
    const id = crypto.randomUUID();
    await kv.set(["wrongNotes", username, id], {
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
    const iter = kv.list({ prefix: ["wrongNotes", username] });
    const wrongList = [];
    for await (const res of iter) wrongList.push(res.value);
    return new Response(JSON.stringify(wrongList), { headers });
  }

  // ====================== 4. 游戏模块 ======================
  // 获取游戏可用单词
  if (path === "/api/get-game-words" && req.method === "GET") {
    const username = url.searchParams.get("username");
    const category = url.searchParams.get("category");
    const userData = await kv.get(["userData", username]);
    if (!userData.value) {
      return new Response(JSON.stringify([]), { headers });
    }
    const knownWords = userData.value.knownWords[category] || [];
    // 模拟单词详情（实际应从单词库获取）
    return new Response(JSON.stringify(knownWords.slice(0, 10)), { headers });
  }

  return new Response("Not found", { status: 404, headers });
});
