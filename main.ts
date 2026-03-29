import { serve } from "https://deno.land/std@0.210.0/http/server.ts";
const kv = await Deno.openKv();

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
    const existingUser = await kv.get(["users", username]);
    if (existingUser.value) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
    await kv.set(["users", username], { username, password });
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

  // 保存已学单词
  if (path === "/api/save-known" && req.method === "POST") {
    const { username, word, category } = await req.json();
    const userData = await kv.get(["userData", username]);
    if (!userData.value) {
      return new Response(JSON.stringify({ success: false }), { headers });
    }
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

  // 获取每日目标
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

  // 更新学习进度
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

  // 游戏单词
  if (path === "/api/get-game-words" && req.method === "GET") {
    const username = url.searchParams.get("username");
    const category = url.searchParams.get("category");
    const userData = await kv.get(["userData", username]);
    if (!userData.value) {
      return new Response(JSON.stringify([]), { headers });
    }
    const knownWords = userData.value.knownWords[category] || [];
    return new Response(JSON.stringify(knownWords.slice(0, 10)), { headers });
  }

  return new Response("Not found", { status: 404, headers: corsHeaders });
});
