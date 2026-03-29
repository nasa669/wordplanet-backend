import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(express.json());

// 内存模拟数据库
const memoryStore = new Map();

// 注册
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (memoryStore.has(`user:${username}`)) {
    return res.json({ success: false });
  }
  memoryStore.set(`user:${username}`, { password });
  memoryStore.set(`userData:${username}`, {
    knownWords: { CET4: [], CET6: [], 考研: [] },
    dailyGoal: { CET4: 10, CET6: 10, 考研: 10 },
    dailyLearned: { CET4: 0, CET6: 0, 考研: 0 },
    lastStudyDate: new Date().toDateString(),
  });
  res.json({ success: true });
});

// 登录
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = memoryStore.get(`user:${username}`);
  if (!user || user.password !== password) {
    return res.json({ success: false });
  }
  res.json({ success: true });
});

// 保存已学单词
app.post('/api/save-known', (req, res) => {
  const { username, word, category } = req.body;
  const userData = memoryStore.get(`userData:${username}`);
  if (!userData) return res.json({ success: false });
  if (!userData.knownWords[category].includes(word)) {
    userData.knownWords[category].push(word);
    memoryStore.set(`userData:${username}`, userData);
  }
  res.json({ success: true });
});

// 获取已学单词
app.get('/api/get-known', (req, res) => {
  const { username, category } = req.query;
  const userData = memoryStore.get(`userData:${username}`);
  res.json(userData ? userData.knownWords[category] || [] : []);
});

// 设置每日目标
app.post('/api/set-daily-goal', (req, res) => {
  const { username, category, goal } = req.body;
  const userData = memoryStore.get(`userData:${username}`);
  if (!userData) return res.json({ success: false });
  userData.dailyGoal[category] = goal;
  memoryStore.set(`userData:${username}`, userData);
  res.json({ success: true });
});

// 获取每日目标
app.get('/api/get-daily-goal', (req, res) => {
  const { username, category } = req.query;
  const userData = memoryStore.get(`userData:${username}`);
  res.json({
    goal: userData?.dailyGoal[category] || 10,
    learned: userData?.dailyLearned[category] || 0,
  });
});

// 更新学习进度
app.post('/api/update-daily-learned', (req, res) => {
  const { username, category, learned } = req.body;
  const userData = memoryStore.get(`userData:${username}`);
  if (!userData) return res.json({ success: false });
  userData.dailyLearned[category] = learned;
  memoryStore.set(`userData:${username}`, userData);
  res.json({ success: true });
});

// 保存错题
app.post('/api/save-wrong', (req, res) => {
  const { username, word, definition, category } = req.body;
  const id = uuidv4();
  memoryStore.set(`wrongNote:${username}:${id}`, {
    word, definition, category, timestamp: new Date().toISOString(),
  });
  res.json({ success: true });
});

// 获取错题
app.get('/api/get-wrong', (req, res) => {
  const { username } = req.query;
  const wrongList = [];
  for (const [key, value] of memoryStore.entries()) {
    if (key.startsWith(`wrongNote:${username}:`)) wrongList.push(value);
  }
  res.json(wrongList);
});

// 游戏单词
app.get('/api/get-game-words', (req, res) => {
  const { username, category } = req.query;
  const userData = memoryStore.get(`userData:${username}`);
  const knownWords = userData?.knownWords[category] || [];
  res.json(knownWords.slice(0, 10));
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
