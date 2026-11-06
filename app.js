(() => {
  "use strict";

  const DATA = window.OSH_DATA;
  if (!DATA || !Array.isArray(DATA.banks)) return;

  const STORE = "industrial-safety-review-progress-v1";
  const THEME = "industrial-safety-review-theme-v1";
  const LETTERS = ["أ", "ب", "ج", "د", "هـ", "و"];
  const lessonMap = [
    { id: "l1", title: "محاضرة 1: التاريخ والتكلفة والمفاهيم", pdf: "sources/lecture-1.pdf" },
    { id: "l2", title: "محاضرة 2: OSHA والمخالفات", pdf: "sources/lecture-2.pdf" },
    { id: "l3", title: "محاضرة 3: مكافحة الحرائق", pdf: "sources/lecture-3.pdf" },
    { id: "l5", title: "محاضرة 5: هرم التحكم وPPE", pdf: "sources/lecture-5.pdf" },
    { id: "loto", title: "LOTO: العزل والإغلاق", pdf: "sources/loto.pdf" }
  ];
  const lessons = Object.fromEntries(lessonMap.map((item) => [item.id, item]));
  const questions = DATA.banks.flatMap((bank, bankIndex) => bank.questions.map((q, questionIndex) => ({
    ...q, id: "b" + bankIndex + "q" + questionIndex, bankIndex, questionIndex, bank: bank.name,
    lesson: lessonMap[bankIndex]
  })));

  let progress = loadProgress();
  let study = null;
  let quiz = null;
  let timerHandle = null;
  let toastHandle = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  function loadProgress() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORE) || "{}");
      return stored && typeof stored.answers === "object" ? { answers: stored.answers } : { answers: {} };
    } catch { return { answers: {} }; }
  }
  function saveProgress() {
    try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch { showToast("تعذر حفظ التقدم محليًا على هذا المتصفح."); }
  }
  function answerOf(question) { return progress.answers[question.id]; }
  function saveAnswer(question, selected, mode) {
    progress.answers[question.id] = { selected, correct: selected === question.answer, mode, updatedAt: new Date().toISOString() };
    saveProgress();
  }
  function stats() {
    const values = Object.values(progress.answers);
    return { total: questions.length, answered: values.length, correct: values.filter((item) => item.correct).length, wrong: values.filter((item) => !item.correct).length };
  }
  function sourceHTML(question) {
    const lesson = question.lesson;
    return '<a class="reference-link" href="' + lesson.pdf + '" target="_blank" rel="noopener">مرجع: ' + escapeHTML(lesson.title) + '</a>';
  }
  function bankLabel(bank) { return bank.name.replace(/\s*\(\d+\)\s*$/, ""); }
  function showToast(message) {
    const box = $("#toast");
    box.textContent = message;
    box.hidden = false;
    clearTimeout(toastHandle);
    toastHandle = setTimeout(() => { box.hidden = true; }, 3500);
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const dark = theme === "dark";
    $("#themeToggle").setAttribute("aria-pressed", String(dark));
    $("#themeToggle").setAttribute("aria-label", dark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي");
    $("#themeIcon").textContent = dark ? "☀" : "☾";
    $(".theme-label").textContent = dark ? "الوضع النهاري" : "الوضع الليلي";
    try { localStorage.setItem(THEME, theme); } catch {}
  }

  function switchView(view) {
    $$(".view-panel").forEach((panel) => {
      const active = panel.dataset.viewPanel === view;
      panel.hidden = !active;
      panel.classList.toggle("is-visible", active);
    });
    $$(".nav-button").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("is-current", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    if (view === "dashboard") renderDashboard();
    if (view === "library") renderLibrary();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function selectLesson(id) {
    $$("[data-lesson-select]").forEach((tab) => {
      const active = tab.dataset.lessonSelect === id;
      tab.setAttribute("aria-selected", String(active));
    });
    $$(".lesson-page").forEach((page) => { page.hidden = page.id !== id; });
  }
  function statusHTML(question) {
    const answer = answerOf(question);
    if (!answer) return '<span class="status-chip">لم تُحل</span>';
    return answer.correct ? '<span class="status-chip correct">صحيحة</span>' : '<span class="status-chip wrong">تحتاج مراجعة</span>';
  }
  function quickStart(bankIndex, destination) {
    if (destination === "study") {
      $("#studySet").value = String(bankIndex);
      startStudy();
      switchView("study");
    } else {
      $("#quizSet").value = String(bankIndex);
      switchView("quiz");
      $("#quizSetup").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function renderDashboard() {
    const root = $("#dashboardRoot");
    const value = stats();
    const percent = value.total ? Math.round((value.correct / value.total) * 100) : 0;
    root.innerHTML =
      '<article class="card dashboard-hero"><p class="eyebrow">لوحة التحكم</p><h3>ابدأ من نقطة واضحة</h3><p class="muted">لديك ' + value.total + ' سؤالًا فعليًا من الملف المرفوع. لا توجد مجموعة أسئلة مستقلة للمحاضرة السادسة في المصدر.</p>' +
      '<div class="stat-grid"><div class="stat"><b>' + value.answered + '</b><span>تمت الإجابة</span></div><div class="stat"><b>' + value.correct + '</b><span>إجابات صحيحة</span></div><div class="stat"><b>' + value.wrong + '</b><span>تحتاج مراجعة</span></div></div>' +
      '<p><strong>نسبة الإتقان الحالية: ' + percent + '%</strong> — أجب أولًا، ثم راجع الأخطاء من بنك الأسئلة.</p></article>' +
      '<div><p class="eyebrow">المجموعات المتاحة</p><div class="bank-grid">' + DATA.banks.map((bank, index) => {
        const bankQuestions = questions.filter((q) => q.bankIndex === index);
        const bankAnswers = bankQuestions.map(answerOf).filter(Boolean);
        const bankCorrect = bankAnswers.filter((a) => a.correct).length;
        return '<article class="card bank-card"><h3>' + escapeHTML(bankLabel(bank)) + '</h3><p>' + bank.questions.length + ' سؤالًا · ' + bankCorrect + ' صحيحًا · ' + (bankAnswers.length - bankCorrect) + ' يحتاج مراجعة</p><div class="bank-actions"><button type="button" class="button button-primary" data-start-study="' + index + '">مذاكرة</button><button type="button" class="button button-secondary" data-start-quiz="' + index + '">اختبار</button></div></article>';
      }).join("") + '</div></div>';
    $$("[data-start-study]", root).forEach((button) => button.addEventListener("click", () => quickStart(Number(button.dataset.startStudy), "study")));
    $$("[data-start-quiz]", root).forEach((button) => button.addEventListener("click", () => quickStart(Number(button.dataset.startQuiz), "quiz")));
  }

  function choiceHTML(question, index, options, name, checked, disabled) {
    return options.map((item, order) => {
      const originalIndex = typeof item === "object" ? item.index : order;
      const text = typeof item === "object" ? item.text : item;
      const selected = checked === originalIndex;
      return '<label class="choice' + (selected ? " is-selected" : "") + '"><input type="radio" name="' + name + '" value="' + originalIndex + '"' + (selected ? " checked" : "") + (disabled ? " disabled" : "") + '><span class="choice-letter">' + LETTERS[order] + '</span><span>' + escapeHTML(text) + '</span></label>';
    }).join("");
  }
  function updateChoiceState(container) {
    $$(".choice", container).forEach((label) => label.classList.toggle("is-selected", $("input", label).checked));
  }

  function startStudy() {
    const bankIndex = Number($("#studySet").value);
    study = { bankIndex, index: 0 };
    renderStudy();
  }
  function renderStudy() {
    const root = $("#studyRoot");
    if (!study) {
      root.innerHTML = '<article class="card question-card"><p>اختر مجموعة الأسئلة ثم اضغط «ابدأ المذاكرة».</p></article>';
      return;
    }
    const bankQuestions = questions.filter((q) => q.bankIndex === study.bankIndex);
    const question = bankQuestions[study.index];
    const saved = answerOf(question);
    root.innerHTML =
      '<article class="card question-card" data-study-question="' + question.id + '"><div class="question-top"><span class="question-number">السؤال ' + (study.index + 1) + ' من ' + bankQuestions.length + '</span>' + statusHTML(question) + '</div>' +
      '<p class="question-text">' + escapeHTML(question.question) + '</p><div class="choices">' + choiceHTML(question, study.index, question.options, "study-choice", saved ? saved.selected : null, Boolean(saved)) + '</div>' +
      '<div id="studyFeedback"></div><div class="question-footer"><span>' + sourceHTML(question) + '</span><div><button type="button" id="studyBack" class="button button-secondary"' + (study.index === 0 ? " disabled" : "") + '>السابق</button> <button type="button" id="studyNext" class="button button-primary">' + (study.index === bankQuestions.length - 1 ? "إنهاء المجموعة" : "التالي") + '</button></div></div></article>';
    if (saved) showStudyFeedback(question, saved);
    $$(".choice input", root).forEach((input) => input.addEventListener("change", (event) => {
      const picked = Number(event.target.value);
      saveAnswer(question, picked, "study");
      $$(".choice", root).forEach((label) => {
        const id = Number($("input", label).value);
        label.classList.toggle("is-correct", id === question.answer);
        label.classList.toggle("is-wrong", id === picked && id !== question.answer);
        $("input", label).disabled = true;
      });
      showStudyFeedback(question, answerOf(question));
      renderDashboard();
    }));
    $("#studyBack").addEventListener("click", () => { study.index--; renderStudy(); });
    $("#studyNext").addEventListener("click", () => {
      if (study.index === bankQuestions.length - 1) { showToast("انتهت مجموعة المذاكرة."); renderDashboard(); return; }
      study.index++; renderStudy();
    });
  }
  function showStudyFeedback(question, answer) {
    const feedback = $("#studyFeedback");
    const correctText = question.options[question.answer];
    feedback.innerHTML = '<div class="feedback ' + (answer.correct ? "correct" : "wrong") + '"><strong>' + (answer.correct ? "إجابة صحيحة ✓" : "إجابة تحتاج مراجعة") + '</strong><p>الإجابة من بنك الأسئلة: <b>' + escapeHTML(correctText) + '</b></p><p>' + sourceHTML(question) + ' لقراءة الشرح الأصلي.</p></div>';
    $$(".choice", $("#studyRoot")).forEach((label) => {
      const id = Number($("input", label).value);
      label.classList.toggle("is-correct", id === question.answer);
      label.classList.toggle("is-wrong", id === answer.selected && id !== question.answer);
      $("input", label).disabled = true;
    });
  }

  function clearQuizTimer() { clearInterval(timerHandle); timerHandle = null; }
  function formatTime(seconds) {
    return Math.max(0, seconds) / 60 | 0 ? String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, "0") + ":" + String(Math.max(0, seconds) % 60).padStart(2, "0") : "00:" + String(Math.max(0, seconds) % 60).padStart(2, "0");
  }
  function startQuiz(event) {
    if (event) event.preventDefault();
    clearQuizTimer();
    const selected = $("#quizSet").value;
    let selectedQuestions = selected === "all" ? questions : questions.filter((q) => q.bankIndex === Number(selected));
    if ($("#shuffleQuestions").checked) selectedQuestions = shuffle(selectedQuestions);
    const shuffleOptions = $("#shuffleOptions").checked;
    quiz = {
      questions: selectedQuestions.map((question) => ({
        question,
        options: shuffleOptions ? shuffle(question.options.map((text, index) => ({ text, index }))) : question.options.map((text, index) => ({ text, index }))
      })),
      seconds: Number($("#timerMinutes").value) * 60,
      timer: Number($("#timerMinutes").value) > 0
    };
    renderQuiz();
    if (quiz.timer) {
      timerHandle = setInterval(() => {
        quiz.seconds--;
        const timer = $("#quizTimer");
        if (timer) timer.textContent = formatTime(quiz.seconds);
        if (quiz.seconds <= 0) { clearQuizTimer(); submitQuiz(true); }
      }, 1000);
    }
  }
  function renderQuiz() {
    const root = $("#quizRoot");
    root.innerHTML = '<div class="quiz-bar"><strong>الأسئلة: ' + quiz.questions.length + '</strong><span id="quizTimer" class="timer">' + (quiz.timer ? formatTime(quiz.seconds) : "بدون مؤقت") + '</span><div class="quiz-actions"><button type="button" id="quizClear" class="button button-secondary">مسح الاختيارات</button><button type="button" id="quizSubmit" class="button button-primary">تصحيح الاختبار</button></div></div>' +
      '<div class="stack">' + quiz.questions.map((entry, index) => '<article class="card question-card"><div class="question-top"><span class="question-number">السؤال ' + (index + 1) + ' من ' + quiz.questions.length + '</span><span class="status-chip">غير مصحح</span></div><p class="question-text">' + escapeHTML(entry.question.question) + '</p><div class="choices">' + choiceHTML(entry.question, index, entry.options, "quiz-" + index, null, false) + '</div></article>').join("") + '</div>';
    $$(".choice input", root).forEach((input) => input.addEventListener("change", () => updateChoiceState(input.closest(".question-card"))));
    $("#quizClear").addEventListener("click", () => { $$("input[type=radio]", root).forEach((input) => { input.checked = false; }); $$(".choice", root).forEach((label) => label.classList.remove("is-selected")); });
    $("#quizSubmit").addEventListener("click", () => submitQuiz(false));
  }
  function submitQuiz(fromTimer) {
    if (!quiz) return;
    clearQuizTimer();
    const root = $("#quizRoot");
    const records = quiz.questions.map((entry, index) => {
      const selectedInput = $('input[name="quiz-' + index + '"]:checked', root);
      const selected = selectedInput ? Number(selectedInput.value) : null;
      if (selected !== null) saveAnswer(entry.question, selected, "quiz");
      return { ...entry, selected, correct: selected === entry.question.answer };
    });
    const correct = records.filter((item) => item.correct).length;
    const unanswered = records.filter((item) => item.selected === null).length;
    const needReview = records.filter((item) => !item.correct);
    root.innerHTML = '<article class="card dashboard-hero"><p class="eyebrow">نتيجة الاختبار</p><h3>' + correct + ' من ' + records.length + ' صحيحة</h3><p class="muted">' + (fromTimer ? "انتهى المؤقت وتم التصحيح تلقائيًا. " : "") + 'غير محلول: ' + unanswered + ' · يحتاج مراجعة: ' + needReview.length + '</p><div class="bank-actions"><button type="button" id="retryQuiz" class="button button-primary">اختبار جديد</button><button type="button" id="reviewQuizErrors" class="button button-secondary">مراجعة الأخطاء</button></div></article>' +
      (needReview.length ? '<div><p class="eyebrow">الأسئلة غير الصحيحة أو غير المحلولة</p><div class="stack">' + needReview.map((item) => resultQuestionHTML(item)).join("") + '</div></div>' : '<article class="notice"><strong>أحسنت.</strong> كل الإجابات في هذا الاختبار صحيحة.</article>');
    $("#retryQuiz").addEventListener("click", () => $("#quizSetup").scrollIntoView({ behavior: "smooth", block: "center" }));
    $("#reviewQuizErrors").addEventListener("click", () => { switchView("library"); $("#statusFilter").value = "wrong"; renderLibrary(); });
    renderDashboard();
  }
  function resultQuestionHTML(item) {
    const selected = item.selected === null ? "لم تُجب" : item.question.options[item.selected];
    return '<article class="card question-card"><div class="question-top"><span class="status-chip wrong">راجعها</span>' + sourceHTML(item.question) + '</div><p class="question-text">' + escapeHTML(item.question.question) + '</p><p>إجابتك: <b>' + escapeHTML(selected) + '</b></p><p>الإجابة من بنك الأسئلة: <b>' + escapeHTML(item.question.options[item.question.answer]) + '</b></p></article>';
  }

  function renderLibrary() {
    const root = $("#libraryRoot");
    const query = $("#questionSearch").value.trim().toLocaleLowerCase("ar");
    const bankFilter = $("#bankFilter").value;
    const statusFilter = $("#statusFilter").value;
    const filtered = questions.filter((question) => {
      const answer = answerOf(question);
      const haystack = [question.question, ...question.options].join(" ").toLocaleLowerCase("ar");
      const status = !answer ? "unanswered" : answer.correct ? "correct" : "wrong";
      return (!query || haystack.includes(query)) && (bankFilter === "all" || question.bankIndex === Number(bankFilter)) && (statusFilter === "all" || status === statusFilter);
    });
    $("#searchCount").textContent = "النتائج: " + filtered.length + " من " + questions.length + " سؤالًا";
    root.innerHTML = filtered.length ? filtered.map((question) => {
      const saved = answerOf(question);
      return '<article class="card question-card"><div class="question-top"><span class="question-number">' + escapeHTML(bankLabel(question.bank)) + ' · سؤال ' + (question.questionIndex + 1) + '</span>' + statusHTML(question) + '</div><p class="question-text">' + escapeHTML(question.question) + '</p><div class="library-answer"><p><b>الإجابة من بنك الأسئلة:</b> ' + escapeHTML(question.options[question.answer]) + '</p>' + (saved ? '<p>آخر إجابة: ' + escapeHTML(question.options[saved.selected]) + '</p>' : "") + '<p>' + sourceHTML(question) + '</p></div></article>';
    }).join("") : '<article class="card question-card"><p>لا توجد نتائج بهذه الفلاتر.</p></article>';
  }

  function populateControls() {
    const options = '<option value="all">كل المجموعات (' + questions.length + ' سؤالًا)</option>' + DATA.banks.map((bank, index) => '<option value="' + index + '">' + escapeHTML(bank.name) + '</option>').join("");
    $("#quizSet").innerHTML = options;
    $("#studySet").innerHTML = DATA.banks.map((bank, index) => '<option value="' + index + '">' + escapeHTML(bank.name) + '</option>').join("");
    $("#bankFilter").innerHTML = '<option value="all">كل المحاضرات</option>' + DATA.banks.map((bank, index) => '<option value="' + index + '">' + escapeHTML(bankLabel(bank)) + '</option>').join("");
  }
  function exportProgress() {
    const payload = { app: "industrial-safety-review", version: 1, exportedAt: new Date().toISOString(), answers: progress.answers };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    link.download = "industrial-safety-progress.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("تم تصدير التقدم.");
  }
  function importProgress(file) {
    if (!file) return;
    if (file.size > 2_000_000) { showToast("ملف التقدم كبير جدًا."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed.answers !== "object" || Array.isArray(parsed.answers)) throw new Error("invalid");
        const valid = {};
        for (const question of questions) {
          const answer = parsed.answers[question.id];
          if (answer && Number.isInteger(answer.selected) && answer.selected >= 0 && answer.selected < question.options.length) {
            valid[question.id] = { selected: answer.selected, correct: answer.selected === question.answer, mode: "import", updatedAt: new Date().toISOString() };
          }
        }
        progress = { answers: valid };
        saveProgress(); renderDashboard(); renderLibrary(); showToast("تم استيراد " + Object.keys(valid).length + " إجابة.");
      } catch { showToast("ملف التقدم غير صالح."); }
    };
    reader.readAsText(file, "utf-8");
  }

  function bindEvents() {
    $$(".nav-button").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
    $("#themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    $$("[data-lesson-select]").forEach((tab) => tab.addEventListener("click", () => selectLesson(tab.dataset.lessonSelect)));
    $("#startStudy").addEventListener("click", startStudy);
    $("#quizSetup").addEventListener("submit", startQuiz);
    $("#questionSearch").addEventListener("input", renderLibrary);
    $("#bankFilter").addEventListener("change", renderLibrary);
    $("#statusFilter").addEventListener("change", renderLibrary);
    $("#exportProgress").addEventListener("click", exportProgress);
    $("#importProgress").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", (event) => importProgress(event.target.files[0]));
    $("#resetProgress").addEventListener("click", () => {
      if (!confirm("هل تريد مسح كل تقدمك المحفوظ على هذا المتصفح؟")) return;
      progress = { answers: {} }; saveProgress(); study = null; clearQuizTimer(); quiz = null;
      renderDashboard(); renderStudy(); renderLibrary(); showToast("تم مسح التقدم.");
    });
  }

  populateControls();
  bindEvents();
  setTheme(localStorage.getItem(THEME) === "dark" ? "dark" : "light");
  renderDashboard();
  renderStudy();
  renderLibrary();
})();
