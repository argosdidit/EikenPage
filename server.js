// server.js

const express = require("express");
const { Client } = require("pg");
const path = require("path");
const app = express();
const PORT = 3000;

// PostgreSQL 接続設定（Render 対応）
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
client.connect();

// GitHub Pages の画像ベースURL
let VOCABULARY_SOURCE_BASE_URL;
VOCABULARY_SOURCE_BASE_URL = "https://argosdidit.github.io/EikenDB/level/section/year_times/vocabulary/vocExplanation/";

let READING_SOURCE_BASE_URL;
READING_SOURCE_BASE_URL = "https://argosdidit.github.io/EikenDB/level/section/year_times/reading/";

let LISTENING_SOURCE_BASE_URL;
LISTENING_SOURCE_BASE_URL = "https://argosdidit.github.io/EikenDB/level/section/year_times/listening/";

// 文章データ（sentence）の prefix 付与
function addReadingSentencePrefix(row) {
  return {
    ...row,
    path_sentence: READING_SOURCE_BASE_URL + row.path_sentence,
    path_explanation: READING_SOURCE_BASE_URL + row.path_explanation
  };
}

// 選択肢データ（choice）の prefix 付与
function addReadingChoicePrefix(row) {
  return {
    ...row,
    path_question: READING_SOURCE_BASE_URL + row.path_question,
    path_choice1: READING_SOURCE_BASE_URL + row.path_choice1,
    path_choice2: READING_SOURCE_BASE_URL + row.path_choice2,
    path_choice3: READING_SOURCE_BASE_URL + row.path_choice3,
    path_choice4: READING_SOURCE_BASE_URL + row.path_choice4
  };
}

// リスニングデータ（audio）の prefix 付与
function addListeningAudioPrefix(row) {
  return {
    ...row,
    path_audio: LISTENING_SOURCE_BASE_URL + row.path_audio
  };
}

// 選択肢データ（choice）の prefix 付与
function addListeningChoicePrefix(row) {
  return {
    ...row,
    path_choice1: LISTENING_SOURCE_BASE_URL + row.path_choice1,
    path_choice2: LISTENING_SOURCE_BASE_URL + row.path_choice2,
    path_choice3: LISTENING_SOURCE_BASE_URL + row.path_choice3,
    path_choice4: LISTENING_SOURCE_BASE_URL + row.path_choice4,
    path_subtitle: LISTENING_SOURCE_BASE_URL + row.path_subtitle,
    path_explanation: LISTENING_SOURCE_BASE_URL + row.path_explanation
  };
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静的ファイル配信（HTML / CSS / JS）
app.use(express.static(path.join(__dirname)));


// -----------------------------
// /api/quizVocabulary エンドポイント
// -----------------------------
app.get("/api/quizVocabulary", async (req, res) => {
  const { level, year, times } = req.query;

  const tableMap = {
    pre2: "voc_pre2",
    grade2: "voc_2",
    pre1: "voc_pre1",
    grade1: "voc_1"
  };

  const tableName = tableMap[level];
  if (!tableName) return res.status(400).json({ error: "Invalid level" });

  try {
    const result = await client.query(
      `
      SELECT
        no,
        sentences,
        word1,
        word2,
        word3,
        word4,
        answer
      FROM ${tableName}
      WHERE year = $1 AND times = $2
      `,
      [year, times]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("quizVocabulary error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// -----------------------------
// /api/saveVocResult (PostgreSQL版)
// -----------------------------
app.post("/api/saveVocResult", async (req, res) => {
  const { account, level, year, times, date, result } = req.body;

  const levelMap = {
    pre2: 4,
    grade2: 3,
    pre1: 2,
    grade1: 1
  };

  const levelClean = level.trim().replace(/\r?\n/g, "");
  const levelId = levelMap[levelClean];

  if (!levelId) {
    return res.status(400).json({ error: "Invalid level" });
  }

  try {
    // PostgreSQL 接続
    const client = await pool.connect();

    // -----------------------------
    // 1. INSERT
    // -----------------------------
    const insertSql = `
      INSERT INTO result_voc (
        account, levelid, year, times, date,
        result1, result2, result3, result4, result5,
        result6, result7, result8, result9, result10,
        result11, result12, result13, result14, result15,
        result16, result17, result18, result19, result20,
        result21, result22, result23, result24, result25
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30
      )
    `;

    const params = [
      account, levelId, year, times, date,
      ...result
    ];

    await client.query(insertSql, params);

    // -----------------------------
    // 2. 古いデータ削除（最新5件だけ残す）
    // -----------------------------
    const deleteSql = `
      DELETE FROM result_voc
      WHERE account = $1
        AND levelid = $2
        AND year = $3
        AND times = $4
        AND date NOT IN (
          SELECT date FROM (
            SELECT date
            FROM result_voc
            WHERE account = $1
              AND levelid = $2
              AND year = $3
              AND times = $4
            ORDER BY date DESC
            LIMIT 5
          ) AS t
        )
    `;

    await client.query(deleteSql, [account, levelId, year, times]);

    client.release();
    res.json({ status: "ok" });

  } catch (err) {
    console.error("saveVocResult error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// -----------------------------
// /api/getVocResult (PostgreSQL版)
// -----------------------------
app.get("/api/getVocResult", async (req, res) => {
  const { account, level, year, times } = req.query;

  const levelMap = {
    pre2: 4,
    grade2: 3,
    pre1: 2,
    grade1: 1
  };

  const levelClean = level.trim().replace(/\r?\n/g, "");
  const levelId = levelMap[levelClean];

  if (!levelId) {
    return res.status(400).json({ error: "Invalid level" });
  }

  try {
    const client = await pool.connect();

    const sql = `
      SELECT *
      FROM result_voc
      WHERE account = $1
        AND levelid = $2
        AND year = $3
        AND times = $4
      ORDER BY date DESC
      LIMIT 5
    `;

    const result = await client.query(sql, [
      account, levelId, year, times
    ]);

    client.release();
    res.json(result.rows);

  } catch (err) {
    console.error("getVocResult error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// -----------------------------
// /api/vocExplanation エンドポイント
// -----------------------------
app.get("/api/vocExplanation", async (req, res) => {
  const { level, year, times } = req.query;

  const tableMap = {
    pre2: "voc_explanation_pre2",
    grade2: "voc_explanation_2",
    pre1: "voc_explanation_pre1",
    grade1: "voc_explanation_1"
  };

  const tableName = tableMap[level];
  if (!tableName) return res.status(400).json({ error: "Invalid level" });

  try {
    const result = await client.query(
      `
      SELECT
      path_explanation
      FROM
      ${tableName}
      WHERE year = $1 AND times = $2
      `,
      [year, times]
    );

    // prefix を付ける
    const vocabularyExplanationWithPrefix = result.rows.map(row => ({
      PATH_EXPLANATION: VOCABULARY_SOURCE_BASE_URL + row.path_explanation
    }));

    res.json(vocabularyExplanationWithPrefix);

    //res.json(result.rows);
  } catch (err) {
    console.error("quizVocabulary error:", err);
    res.status(500).json({ error: "DB error" });
  }
});


// -----------------------------
// /api/reading エンドポイント
// -----------------------------
app.get("/api/reading", async (req, res) => {
  const { level, year, times } = req.query;

  const tableSentence = {
    pre2: "reading_sentence_pre2",
    grade2: "reading_sentence_2",
    pre1: "reading_sentence_pre1",
    grade1: "reading_sentence_1"
  };

  const tableChoice = {
    pre2: "reading_choice_pre2",
    grade2: "reading_choice_2",
    pre1: "reading_choice_pre1",
    grade1: "reading_choice_1"
  };

  const sentenceTable = tableSentence[level];
  const choiceTable = tableChoice[level];

  if (!sentenceTable || !choiceTable) {
    return res.status(400).json({ error: "Invalid level" });
  }

  try {
    const sentenceResult = await client.query(
      `
      SELECT
        levelid,
        year,
        times,
        area,
        clause,
        subject,
        path_sentence,
        path_explanation
      FROM ${sentenceTable}
      WHERE year = $1 AND times = $2
      `,
      [year, times]
    );

    const choiceResult = await client.query(
      `
      SELECT
        levelid,
        year,
        times,
        area,
        no,
        clause,
        subject,
        path_question,
        path_choice1,
        path_choice2,
        path_choice3,
        path_choice4,
        answer
      FROM ${choiceTable}
      WHERE year = $1 AND times = $2
      `,
      [year, times]
    );

    // ★ ここで prefix を付ける
    const readingSentenceWithPrefix = sentenceResult.rows.map(addReadingSentencePrefix);
    const readingChoiceWithPrefix = choiceResult.rows.map(addReadingChoicePrefix);

    res.json({
      sentence: readingSentenceWithPrefix,
      choice: readingChoiceWithPrefix
    });

  } catch (err) {
    console.error("reading error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// -----------------------------
// /api/listening エンドポイント（PostgreSQL版）
// -----------------------------
app.get("/api/listening", async (req, res) => {
  const { level, year, times } = req.query;

  // レベル → テーブル名のマッピング
  const tableAudio = {
    pre2: "listening_audio_pre2",
    grade2: "listening_audio_2",
    pre1: "listening_audio_pre1",
    grade1: "listening_audio_1"
  };

  const tableChoice = {
    pre2: "listening_choice_pre2",
    grade2: "listening_choice_2",
    pre1: "listening_choice_pre1",
    grade1: "listening_choice_1"
  };

  const audioTable = tableAudio[level];
  const choiceTable = tableChoice[level];

  if (!audioTable || !choiceTable) {
    return res.status(400).json({ error: "Invalid level" });
  }

  try {
    // 音声データ
    const audioResult = await client.query(
      `
      SELECT
        levelid,
        year,
        times,
        area,
        path_audio
      FROM ${audioTable}
      WHERE year = $1 AND times = $2
      `,
      [year, times]
    );

    // 設問データ
    const choiceResult = await client.query(
      `
      SELECT
        levelid,
        year,
        times,
        area,
        no,
        path_choice1,
        path_choice2,
        path_choice3,
        path_choice4,
        path_subtitle,
        path_explanation,
        time_sec_start,
        time_sec_end,
        answer
      FROM ${choiceTable}
      WHERE year = $1 AND times = $2
      `,
      [year, times]
    );

    // prefix 付与
    const listeningAudioWithPrefix = audioResult.rows.map(addListeningAudioPrefix);
    const listeningChoiceWithPrefix = choiceResult.rows.map(addListeningChoicePrefix);

    res.json({
      audio: listeningAudioWithPrefix,
      choice: listeningChoiceWithPrefix
    });

  } catch (err) {
    console.error("listening error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

// -----------------------------
// サーバー起動
// -----------------------------
app.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});