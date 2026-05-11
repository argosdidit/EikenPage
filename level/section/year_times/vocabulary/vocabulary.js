const VocabularyApp = (() => {
  'use strict';

  let
    container,
    quizData = [],
    data_pathVocExplanation,
    pathExplanationUrl,
    levelParam,
    fieldParam,

    year,
    times,
    displayAccount,

    func,
    active,
    flag;

  const conf = {
    container: "quiz-container",
    resultBox: "result-box",
    checkButton: "check-all",
    backLink: "back-link",
    header: "header",
  };

  func = {
    init: function () {
      const urlParams = new URLSearchParams(window.location.search);
      levelParam = urlParams.get("level") || "pre2";
      fieldParam = urlParams.get("field") || "vocabulary";
      displayAccount = "namename";

      return this;
    },

    loadQuiz: async function () {
      const urlParams = new URLSearchParams(window.location.search);
      const level = urlParams.get("level");
      year = urlParams.get("year");
      times = urlParams.get("times");

      const res = await fetch(`/api/quizVocabulary?level=${level}&year=${year}&times=${times}`);
      quizData = await res.json();

      const res_vocExplanation = await fetch(`/api/vocExplanation?level=${level}&year=${year}&times=${times}`);
      data_pathVocExplanation = await res_vocExplanation.json();

      return this;
    },

    setupHeader: function () {
      const header = document.getElementById(conf.header);
      const backLink = document.getElementById(conf.backLink);

      const levelMap = {
        grade1: { label: "1級", color: "#ffcccc" },
        pre1:   { label: "準1級", color: "#e6ccff" },
        grade2: { label: "2級", color: "#cce6ff" },
        pre2:   { label: "準2級", color: "#fff7cc" }
      };

      const { label, color } = levelMap[levelParam] || levelMap["pre2"];
      header.style.backgroundColor = color;
      header.querySelector("h1").textContent = `ワード ${label} ${year}年 ${times}回`;

      backLink.href = `../year_times.html?level=${levelParam}&field=${fieldParam}`;

      return this;
    },

    renderQuiz: function () {
      container = document.getElementById(conf.container);

      quizData.forEach((item, index) => {
        const box = document.createElement("div");
        box.className = "quiz-box";

        const number = item.no.toString().padStart(2, "0");

        // 正規表現はテンプレートリテラルの外で作る
        const reg = new RegExp("\\[(\\d+)\\]", "g");
        const questionHTML = item.sentences.replace(reg, `[${number}]`);

        box.innerHTML = `
          <div class="quiz-question">[No.${number}]<br>${questionHTML}</div>
          <div class="options">
            ${[item.word1, item.word2, item.word3, item.word4]
              .map((w, i) => `<div class="option" data-value="${i + 1}">${i + 1}. ${w}</div>`)
              .join("")}
          </div>
        `;

        container.appendChild(box);
      });
      return this;
    },
    enableSelect: function () {
      container.addEventListener("click", (e) => {
        if (!e.target.classList.contains("option")) return;

        const options = e.target.parentElement.querySelectorAll(".option");
        options.forEach(opt => opt.classList.remove("selected"));
        e.target.classList.add("selected");
      });

      return this;
    },

    enableCheck: function () {
      const button = document.getElementById(conf.checkButton);
      
      button.addEventListener("click", async () => {
        button.disabled = true;
        let resultArray = [];
        let score = 0;
        
        // 25問採点
        container.querySelectorAll(".quiz-box").forEach((box, index) => {
          const selected = box.querySelector(".option.selected");
          const correctIndex = quizData[index].answer;
          const correctWord = quizData[index][`word${correctIndex}`];

          const number = (index + 1).toString().padStart(2, "0");

          // 正規表現はテンプレート外で作る
          const reg = new RegExp("\\[0*" + number + "\\]");
          const questionDiv = box.querySelector(".quiz-question");

          questionDiv.innerHTML = questionDiv.innerHTML.replace(
            reg,
            `<span style="color:red;">${correctWord}</span>`
          );
          
          if (selected) {
            const userAnswer = Number(selected.dataset.value);
            if (userAnswer === correctIndex) {
              score++;
              resultArray[index] = 0;      // 正解
            } else {
              resultArray[index] = userAnswer; // 不正解（1〜4）
            }
          } else {
            resultArray[index] = 99;       // 未回答
          }
        });

        container.querySelectorAll(".quiz-box").forEach((box, index) => {
          const selected = box.querySelector(".option.selected");
          const correctIndex = quizData[index].answer;
          const correctWord = quizData[index][`word{correctIndex}`];

          const number = (index + 1).toString().padStart(2, "0");

          // 正規表現はテンプレート外で作る
          const reg = new RegExp("\\[0*" + number + "\\]");
          const questionDiv = box.querySelector(".quiz-question");

          questionDiv.innerHTML = questionDiv.innerHTML.replace(
            reg,
            `<span style="color:red;">${correctWord}</span>`
          );

          let result = document.createElement("div");
          result.textContent = `No.${number} `;

          if (selected) {
            const userAnswer = Number(selected.dataset.value);
            if (userAnswer === correctIndex) {
              selected.classList.add("correct");
              result.textContent += "正解";
              result.style.color = "green";
              score++;
            } else {
              selected.classList.add("incorrect");
              result.textContent += "不正解";
              result.style.color = "red";
            }
          } else {
            result.textContent += "未回答";
            result.style.color = "blue";
          }
        });

        // ★ ここで 25 個に揃える
        while (resultArray.length < 25) {
          resultArray.push(50);
        }

        // ★ DATE（YYYYMMDDHHMMSS）
        const now = new Date();
        const DATE =
        now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0") +
        String(now.getHours()).padStart(2, "0") +
        String(now.getMinutes()).padStart(2, "0") +
        String(now.getSeconds()).padStart(2, "0");
        
        // ★ DB 保存 → 履歴表示
        await func.updateResult(resultArray, DATE);
        await func.loadHistory();
      });
      return this;
    },
    updateResult: async function(resultArray, DATE){
      const body = {
          account: displayAccount,
          level: levelParam,
          year: Number(year),
          times: Number(times),
          date: DATE,
          result: resultArray
        };
        await fetch("/api/saveVocResult", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      return this;
    },
    loadHistory: async function() {
      const url = `/api/getVocResult?account=${displayAccount}&level=${levelParam}&year=${year}&times=${times}`;
      const res = await fetch(url);
      const data = await res.json();
      
      const historyBox = document.getElementById("historyBox");
      historyBox.innerHTML = "";

      const questionCount = quizData.length; // ← ここが超重要

      let html =
      `
      <h3>${displayAccount} さんの履歴</h3>
      <table border="1" style="border-collapse: collapse; margin-top:20px;">
      <tr>
      <th>LEVEL</th>
      <th>YEAR</th>
      <th>TIMES</th>
      <th>DATE-TIME</th>
      ${Array.from({ length: questionCount }, (_, i) => `<th>${i+1}</th>`).join("")}
      </tr>
      `;
      
      data.forEach(row => {
        const dateFormatted =
        row.date.slice(0,4) + "/" +
        row.date.slice(4,6) + "/" +
        row.date.slice(6,8) + " " +
        row.date.slice(8,10) + ":" +
        row.date.slice(10,12) + ":" +
        row.date.slice(12,14);
        
        html +=
        `
        <tr>
        <td>${levelParam}</td>
        <td>${row.year}</td>
        <td>${row.times}</td>
        <td>${dateFormatted}</td>
        ${Array.from({ length: questionCount }, (_, i) => {
          const v = row[`result${i+1}`];
          if (v === 0) return `<td style="color:green;">正</td>`;
          if (v === 99) return `<td style="color:blue;">未</td>`;
          if (v === 50) return `<td style="background:#eee; color:#666;">無</td>`;
          return `<td style="color:red;">${v}</td>`;
        }).join("")}
        </tr>
        `;
      });
      html += "</table>";
      historyBox.innerHTML = html;
    }
  };

  active = () => {
    func
      .init()
      .loadQuiz()
      .then(() => {
        func
          .setupHeader()
          .renderQuiz()
          .enableSelect()
          .enableCheck();
      });
  };

  return { active };
})();

window.addEventListener("load", () => {
  VocabularyApp.active();
});
