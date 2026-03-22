const topicDocuments = {
    "Agent学习": [
        {
            title: "Agent 自主学习框架 V2.0",
            description: "探讨大模型在闭环环境中的自我演化能力，包括错误修正和知识积累机制。",
            content: "这是一篇关于 Agent 自主学习框架 V2.0 的完整内容。\n\n1. 闭环反馈机制\n2. 记忆与检索\n3. 自我纠错策略",
            image: "",
            updated: "2小时前更新",
            pinned: false,
            marked: false
        }
    ],
    "健身饮食": [
        {
            title: "高强度训练期间的碳水循环规划",
            description: "对比不同体质在增肌期的碳水分配比例，重点关注训练日和休息日的调整。",
            content: "这是一篇关于碳水循环规划的完整内容。\n\n- 训练日高碳\n- 休息日低碳\n- 持续跟踪体脂变化",
            image: "",
            updated: "3小时前更新",
            pinned: false,
            marked: false
        }
    ],
    "如何成为多面手": [],
    "英语语法核心": [],
    "前端工程化": [],
    "UI设计美学": []
};

let currentTopic = "Agent学习";
let currentEditItem = null;
let isDragging = false;
let startX = 0;
let currentX = 0;
let hasMoved = false;
let openTopicActionItem = null;
let openCardMenu = null;
let currentExpandedDocIndex = null;
let topicTooltip = null;
let mindNodes = [];
let mindTreeByTopic = {};
let selectedMindNodeId = null;
let draggingMindNodeId = null;
let mindDragOffset = { x: 0, y: 0 };
let mindTreeInitialized = false;
let mindView = { x: 40, y: 36, scale: 1 };
let mindPanning = false;
let mindPanStart = null;
const MIND_SCALE_MIN = 0.25;
const MIND_SCALE_MAX = 2.75;
let mindGlobalHandlersBound = false;
let aiChatHistory = [];
let uploadMode = "file";

document.addEventListener("DOMContentLoaded", () => {
    initTopicTooltips();
    initNavSwitch();
    initModals();
    initSwipeActions();
    initSearch();
    initSidebarDrawer();
    loadTopicDocuments(currentTopic);
    syncTopicSelectOptions();
    initMindTreeEditor();
    initAiHeaderToggle();
    initPanelResizer();
    initAiChat();
});

function getDeepSeekApiKey() {
    if (typeof window !== "undefined" && window.KNOWLINK_DEEPSEEK_KEY) {
        return String(window.KNOWLINK_DEEPSEEK_KEY).trim();
    }
    try {
        return (localStorage.getItem("KNOWLINK_DEEPSEEK_KEY") || "").trim();
    } catch (_) {
        return "";
    }
}

function initSidebarDrawer() {
    const btn = document.getElementById("sidebarToggleBtn");
    const reopenBtn = document.getElementById("sidebarReopenBtn");
    const drawer = document.getElementById("topicDrawer");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (!btn || !drawer) return;

    const isMobile = () => window.matchMedia("(max-width: 992px)").matches;

    const setOpen = (open) => {
        drawer.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("title", open ? "收起知识集" : "展开知识集");
        const btnText = btn.querySelector(".sidebar-inline-toggle-text");
        if (btnText) btnText.textContent = open ? "收起" : "展开";

        const mainContent = document.querySelector(".main-content");
        if (mainContent) {
            mainContent.classList.toggle("sidebar-collapsed", !open && !isMobile());
        }

        if (reopenBtn) {
            const showReopen = !open && !isMobile();
            reopenBtn.hidden = !showReopen;
            reopenBtn.setAttribute("aria-hidden", showReopen ? "false" : "true");
        }

        document.body.classList.toggle("drawer-mobile-open", open && isMobile());
        if (backdrop) backdrop.hidden = !(open && isMobile());
    };

    setOpen(true);

    btn.addEventListener("click", () => {
        setOpen(!drawer.classList.contains("is-open"));
    });

    if (reopenBtn) {
        reopenBtn.addEventListener("click", () => setOpen(true));
    }

    if (backdrop) {
        backdrop.addEventListener("click", () => setOpen(false));
    }

    window.addEventListener("resize", () => {
        if (!isMobile() && backdrop) backdrop.hidden = true;
    });
}

function syncNavActiveTopic(topicName) {
    document.querySelectorAll(".topic-item").forEach((node) => {
        node.classList.toggle("active", getTopicName(node) === topicName);
    });
}

function getTopicName(item) {
    const node = item.querySelector(".topic-name");
    return node ? node.textContent.trim() : "";
}

function initNavSwitch() {
    const list = document.getElementById("knowledgeList");
    if (!list) return;

    list.addEventListener("click", (e) => {
        const item = e.target.closest(".topic-item");
        if (!item) return;
        if (e.target.closest(".topic-actions") || e.target.closest(".action-btn")) return;
        if (hasMoved) return;

        document.querySelectorAll(".topic-item").forEach((node) => node.classList.remove("active"));
        saveCurrentMindTree();
        item.classList.add("active");
        currentTopic = getTopicName(item);
        currentExpandedDocIndex = null;
        const searchInput = document.getElementById("globalSearchInput");
        if (searchInput) searchInput.value = "";
        loadTopicDocuments(currentTopic);
        loadMindTreeForTopic(currentTopic);
    });
}

function initTopicTooltips() {
    if (!topicTooltip) {
        topicTooltip = document.createElement("div");
        topicTooltip.className = "tooltip";
        document.body.appendChild(topicTooltip);
    }

    document.querySelectorAll(".topic-item").forEach((item) => {
        item.onmouseenter = null;
        item.onmousemove = null;
        item.onmouseleave = null;

        item.addEventListener("mouseenter", (e) => {
            const description = item.dataset.description || "";
            if (!description.trim()) return;
            topicTooltip.textContent = description;
            topicTooltip.classList.add("show");
            positionTopicTooltip(e);
        });

        item.addEventListener("mousemove", (e) => {
            if (!topicTooltip.classList.contains("show")) return;
            positionTopicTooltip(e);
        });

        item.addEventListener("mouseleave", () => {
            topicTooltip.classList.remove("show");
        });
    });
}

function positionTopicTooltip(e) {
    if (!topicTooltip) return;
    const offset = 12;
    const tooltipWidth = 250;
    const tooltipHeight = 60;
    let left = e.clientX + offset;
    let top = e.clientY + offset;

    if (left + tooltipWidth > window.innerWidth - 8) {
        left = e.clientX - tooltipWidth - offset;
    }
    if (top + tooltipHeight > window.innerHeight - 8) {
        top = window.innerHeight - tooltipHeight - 8;
    }

    topicTooltip.style.left = `${left}px`;
    topicTooltip.style.top = `${top}px`;
}

function initModals() {
    const newTopicModal = document.getElementById("newTopicModal");
    const quickImportModal = document.getElementById("quickImportModal");
    const newTopicBtn = document.getElementById("newTopicBtn");
    const quickImportBtn = document.getElementById("quickImportBtn");
    const createTopicBtn = document.getElementById("createTopicBtn");
    const uploadDocumentBtn = document.getElementById("uploadDocumentBtn");

    if (newTopicBtn && newTopicModal) {
        newTopicBtn.addEventListener("click", () => newTopicModal.classList.add("show"));
    }

    if (quickImportBtn && quickImportModal) {
        quickImportBtn.addEventListener("click", () => {
            const topicSelect = document.getElementById("topicSelect");
            if (topicSelect && [...topicSelect.options].some((opt) => opt.value === currentTopic)) {
                topicSelect.value = currentTopic;
            }
            quickImportModal.classList.add("show");
        });
    }

    document.querySelectorAll(".close-btn, .cancel-btn").forEach((btn) => {
        btn.addEventListener("click", () => closeModal(btn.closest(".modal")));
    });

    document.querySelectorAll(".modal").forEach((modal) => {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        document.querySelectorAll(".modal.show").forEach((modal) => closeModal(modal));
    });

    if (createTopicBtn) createTopicBtn.addEventListener("click", createNewTopic);
    if (uploadDocumentBtn) uploadDocumentBtn.addEventListener("click", uploadDocument);

    initQuickImportPanels();

    const topicSelect = document.getElementById("topicSelect");
    if (topicSelect) {
        topicSelect.addEventListener("change", (e) => {
            if (e.target.value === "new") {
                closeModal(quickImportModal);
                newTopicModal.classList.add("show");
            }
        });
    }

    const topicDescription = document.getElementById("topicDescription");
    const editTopicDescription = document.getElementById("editTopicDescription");
    bindTextCount(topicDescription, ".char-count");
    bindTextCount(editTopicDescription, "#editTopicModal .char-count");

    document.querySelectorAll("#newTopicModal .icon-option").forEach((opt) => {
        opt.addEventListener("click", () => {
            document.querySelectorAll("#newTopicModal .icon-option").forEach((node) => node.classList.remove("selected"));
            opt.classList.add("selected");
        });
    });

    const saveEditBtn = document.getElementById("saveEditBtn");
    if (saveEditBtn) saveEditBtn.addEventListener("click", saveEditTopic);
}

function bindTextCount(input, countSelector) {
    if (!input) return;
    const counter = document.querySelector(countSelector);
    if (!counter) return;
    input.addEventListener("input", () => {
        const len = input.value.length;
        counter.textContent = `${len}/50`;
        counter.classList.toggle("warning", len >= 40);
    });
}

function closeModal(modal) {
    if (modal) modal.classList.remove("show");
}

function createNewTopic() {
    const nameInput = document.getElementById("topicName");
    const descInput = document.getElementById("topicDescription");
    const selectedIcon = document.querySelector("#newTopicModal .icon-option.selected");
    const list = document.getElementById("knowledgeList");
    if (!nameInput || !descInput || !list) return;

    const name = nameInput.value.trim();
    const description = descInput.value.trim();
    const icon = selectedIcon ? selectedIcon.textContent : "📚";
    if (!name) {
        alert("请输入主题名称");
        return;
    }

    if ([...document.querySelectorAll(".topic-name")].some((node) => node.textContent.trim() === name)) {
        alert("主题名称已存在");
        return;
    }

    const item = document.createElement("li");
    item.className = "topic-item";
    item.dataset.description = description;
    item.innerHTML = `
        <div class="topic-content">
            <span class="icon">${icon}</span>
            <span class="topic-name">${name}</span>
        </div>
        <div class="topic-actions">
            <button class="action-btn pin-btn" title="置顶">📌</button>
            <button class="action-btn edit-btn" title="编辑">✏️</button>
        </div>
    `;
    list.appendChild(item);
    topicDocuments[name] = [];
    mindTreeByTopic[name] = [{ id: "root", text: name, x: 160, y: 80, parentId: null }];

    initSwipeActions();
    initTopicTooltips();
    syncTopicSelectOptions();

    nameInput.value = "";
    descInput.value = "";
    document.querySelector("#newTopicModal .char-count").textContent = "0/50";
    closeModal(document.getElementById("newTopicModal"));
    showNotification("主题创建成功");
}

function syncTopicSelectOptions() {
    const topicSelect = document.getElementById("topicSelect");
    if (!topicSelect) return;

    const current = topicSelect.value;
    const staticOptions = [...topicSelect.querySelectorAll("option")].filter((opt) => opt.value === "" || opt.value === "new");
    topicSelect.innerHTML = "";
    staticOptions.forEach((opt) => topicSelect.appendChild(opt));

    document.querySelectorAll(".topic-item .topic-name").forEach((node) => {
        const option = document.createElement("option");
        option.value = node.textContent.trim();
        option.textContent = node.textContent.trim();
        topicSelect.appendChild(option);
    });

    if ([...topicSelect.options].some((opt) => opt.value === current)) {
        topicSelect.value = current;
    }
}

function uploadDocument() {
    const quickImportModal = document.getElementById("quickImportModal");
    const topicSelect = document.getElementById("topicSelect");
    const fileInput = document.getElementById("fileInput");
    const imageInput = document.getElementById("imageInput");
    const audioInput = document.getElementById("audioInput");
    const textInput = document.getElementById("quickTextInput");
    const urlInput = document.getElementById("webUrlInput");
    if (!topicSelect) return;

    const selectedTopic = topicSelect.value;
    if (!selectedTopic || selectedTopic === "new") {
        alert("请先选择要归属的主题");
        return;
    }
    if (!topicDocuments[selectedTopic]) topicDocuments[selectedTopic] = [];

    const finishInsert = (doc, successText) => {
        topicDocuments[selectedTopic].unshift(doc);

        const topicItem = [...document.querySelectorAll(".topic-item")].find((item) => getTopicName(item) === selectedTopic);
        if (topicItem) {
            document.querySelectorAll(".topic-item").forEach((node) => node.classList.remove("active"));
            topicItem.classList.add("active");
        }

        currentTopic = selectedTopic;
        currentExpandedDocIndex = null;
        loadTopicDocuments(currentTopic);
        loadMindTreeForTopic(currentTopic);
        closeModal(quickImportModal);
        if (fileInput) fileInput.value = "";
        if (imageInput) imageInput.value = "";
        if (audioInput) audioInput.value = "";
        if (textInput) textInput.value = "";
        if (urlInput) urlInput.value = "";
        showNotification(successText || "导入成功");
    };

    if (uploadMode === "url") {
        const rawUrl = (urlInput?.value || "").trim();
        if (!rawUrl) {
            showNotification("请输入网页链接");
            return;
        }

        importFromWebUrl(rawUrl)
            .then((doc) => {
                doc.tags = ["网页", "自动摘要", "自动标签"];
                finishInsert(doc, doc.pdfWarning ? "网页链接已导入（PDF 转存暂不可用）" : "网页链接已导入，已生成摘要与标签");
                if (doc.pdfWarning) {
                    showNotification(doc.pdfWarning);
                }
            })
            .catch((err) => {
                const msg = err instanceof Error ? err.message : "网页导入失败，请重试";
                showNotification(msg);
            });
        return;
    }

    if (uploadMode === "text") {
        const rawText = (textInput?.value || "").trim();
        if (!rawText) {
            alert("请先粘贴或输入文字片段");
            return;
        }
        const keywords = extractSimpleKeywords(rawText);
        const description = rawText.replace(/\s+/g, " ").slice(0, 90) + (rawText.length > 90 ? "..." : "");
        finishInsert(
            {
                title: `文字片段 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
                description,
                content: `${rawText}\n\n关键词：${keywords.join("、") || "（待识别）"}`,
                image: "",
                updated: "刚刚导入",
                pinned: false,
                marked: false,
                sourceUrl: "",
                pdfDataUrl: "",
                tags: keywords
            },
            "文字片段已导入并识别关键词"
        );
        return;
    }

    const selectedFile = uploadMode === "image"
        ? imageInput?.files?.[0] || null
        : uploadMode === "audio"
        ? audioInput?.files?.[0] || null
        : fileInput?.files?.[0] || null;

    if (!selectedFile) {
        alert(uploadMode === "image" ? "请先选择图片" : uploadMode === "audio" ? "请先选择音频文件" : "请先选择要上传的文件");
        return;
    }

    readUploadedFile(selectedFile)
        .then((parsed) => {
            const title = selectedFile.name.replace(/\.[^.]+$/, "") || `新文档 ${topicDocuments[selectedTopic].length + 1}`;
            const content = (parsed.content || "").trim();
            const shortDescription = content
                ? content.replace(/\s+/g, " ").slice(0, 90) + (content.length > 90 ? "..." : "")
                : "该文件暂不支持全文解析，已保留文件信息。";

            const extraPrefix =
                uploadMode === "image"
                    ? "[OCR识别结果示例]\n（当前为前端演示，接入 OCR API 后可替换为真实识别文本）\n\n"
                    : uploadMode === "audio"
                    ? "[语音转写示例]\n（当前为前端演示，接入 ASR API 后可替换为真实转写与时间戳）\n[00:00] 开始记录...\n\n"
                    : "";

            const doc = {
                title,
                description: shortDescription,
                content: `${extraPrefix}${content || `文件名：${selectedFile.name}\n文件类型：${selectedFile.type || "未知类型"}\n大小：${Math.ceil(selectedFile.size / 1024)} KB`}`,
                image: parsed.image || "",
                updated: "刚刚导入",
                pinned: false,
                marked: false,
                sourceUrl: "",
                pdfDataUrl: ""
            };
            finishInsert(doc, uploadMode === "image" ? "图片已导入（含 OCR 占位结果）" : uploadMode === "audio" ? "语音已导入（含转写占位结果）" : "文档上传成功");
        })
        .catch(() => {
            alert("文件读取失败，请重试");
        });
}

function readUploadedFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const type = file.type || "";
        const lowerName = file.name.toLowerCase();
        const isText = type.startsWith("text/") || lowerName.endsWith(".md") || lowerName.endsWith(".txt");
        const isImage = type.startsWith("image/");

        reader.onerror = () => reject(new Error("read failed"));
        reader.onload = () => {
            if (isImage) {
                resolve({
                    content: `图片文件：${file.name}`,
                    image: typeof reader.result === "string" ? reader.result : ""
                });
                return;
            }
            resolve({
                content: typeof reader.result === "string" ? reader.result : "",
                image: ""
            });
        };

        if (isImage) {
            reader.readAsDataURL(file);
            return;
        }
        if (isText) {
            reader.readAsText(file, "utf-8");
            return;
        }

        resolve({
            content: "",
            image: ""
        });
    });
}

function initQuickImportPanels() {
    const cards = [...document.querySelectorAll(".quick-entry-card")];
    const panels = [...document.querySelectorAll(".quick-panel")];
    const fileInput = document.getElementById("fileInput");
    const imageInput = document.getElementById("imageInput");
    const audioInput = document.getElementById("audioInput");
    const browseFileBtn = document.getElementById("browseFileBtn");
    const browseImageBtn = document.getElementById("browseImageBtn");
    const browseAudioBtn = document.getElementById("browseAudioBtn");

    if (!cards.length || !panels.length) return;

    const setMode = (mode) => {
        uploadMode = mode;
        cards.forEach((card) => card.classList.toggle("active", card.dataset.sourceType === mode));
        panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panelType === mode));
    };

    cards.forEach((card) => {
        card.addEventListener("click", () => setMode(card.dataset.sourceType || "url"));
    });

    if (browseFileBtn && fileInput) browseFileBtn.addEventListener("click", () => fileInput.click());
    if (browseImageBtn && imageInput) browseImageBtn.addEventListener("click", () => imageInput.click());
    if (browseAudioBtn && audioInput) browseAudioBtn.addEventListener("click", () => audioInput.click());

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            if (!fileInput.files?.[0]) return;
            showNotification(`已选择文档：${fileInput.files[0].name}`);
        });
    }
    if (imageInput) {
        imageInput.addEventListener("change", () => {
            if (!imageInput.files?.[0]) return;
            showNotification(`已选择图片：${imageInput.files[0].name}`);
        });
    }
    if (audioInput) {
        audioInput.addEventListener("change", () => {
            if (!audioInput.files?.[0]) return;
            showNotification(`已选择音频：${audioInput.files[0].name}`);
        });
    }

    ["fileDropZone", "imageDropZone", "audioDropZone"].forEach((zoneId) => {
        const zone = document.getElementById(zoneId);
        if (!zone) return;
        zone.addEventListener("dragover", (e) => {
            e.preventDefault();
            zone.classList.add("drag-over");
        });
        zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.classList.remove("drag-over");
            const file = e.dataTransfer?.files?.[0];
            if (!file) return;
            if (zoneId === "fileDropZone" && fileInput) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                showNotification(`已拖入文档：${file.name}`);
            }
            if (zoneId === "imageDropZone" && imageInput) {
                const dt = new DataTransfer();
                dt.items.add(file);
                imageInput.files = dt.files;
                showNotification(`已拖入图片：${file.name}`);
            }
            if (zoneId === "audioDropZone" && audioInput) {
                const dt = new DataTransfer();
                dt.items.add(file);
                audioInput.files = dt.files;
                showNotification(`已拖入音频：${file.name}`);
            }
        });
    });

    setMode("url");
}

function extractSimpleKeywords(text) {
    const stopWords = new Set(["的", "了", "和", "是", "在", "与", "及", "并", "或", "我", "你", "他", "她", "它", "我们", "他们", "一个", "这个", "那个", "进行", "可以", "需要", "通过", "以及", "如果", "然后", "因为", "所以"]);
    const normalized = String(text || "")
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
        .toLowerCase();
    const words = normalized
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2 && !stopWords.has(w));

    const counter = new Map();
    words.forEach((word) => counter.set(word, (counter.get(word) || 0) + 1));
    return [...counter.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([word]) => word);
}

function extractTitleFromUrl(url) {
    try {
        const parsed = new URL(url);
        const slug = parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname;
        return decodeURIComponent(slug).replace(/[-_]+/g, " ").slice(0, 80) || parsed.hostname;
    } catch (_) {
        return "网页文档";
    }
}

function normalizeWebUrl(rawUrl) {
    const text = String(rawUrl || "").trim();
    if (!text) throw new Error("请输入有效网页链接");
    const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    const parsed = new URL(withScheme);
    if (!/^https?:$/i.test(parsed.protocol)) throw new Error("仅支持 http/https 网页链接");
    return parsed.toString();
}

async function fetchWebPageContent(url) {
    const proxied = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`;
    const res = await fetch(proxied, {
        method: "GET",
        headers: { Accept: "text/plain" }
    });
    if (!res.ok) throw new Error(`网页读取失败（${res.status}）`);
    const text = (await res.text()).trim();
    if (!text) throw new Error("网页内容为空，无法导入");
    return text;
}

function splitTextForPdf(text, maxChars) {
    const lines = [];
    const sourceLines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    sourceLines.forEach((line) => {
        const clean = line.replace(/\t/g, "    ");
        if (!clean) {
            lines.push("");
            return;
        }
        for (let i = 0; i < clean.length; i += maxChars) {
            lines.push(clean.slice(i, i + maxChars));
        }
    });
    return lines;
}

function buildSimplePdfDataUrl(title, sourceUrl, content) {
    const jsPdf = window.jspdf && window.jspdf.jsPDF;
    if (!jsPdf) throw new Error("PDF 引擎加载失败，请刷新后重试");

    const doc = new jsPdf({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 42;
    const lineHeight = 16;
    const maxChars = 60;

    let y = margin;

    const ensurePage = () => {
        if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text((title || "网页文档").slice(0, 80), margin, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const sourceRows = splitTextForPdf(`来源链接: ${sourceUrl}`, maxChars);
    sourceRows.forEach((row) => {
        ensurePage();
        doc.text(row, margin, y, { maxWidth: pageWidth - margin * 2 });
        y += lineHeight;
    });

    y += 8;
    const bodyRows = splitTextForPdf(content, maxChars);
    bodyRows.forEach((row) => {
        ensurePage();
        doc.text(row, margin, y, { maxWidth: pageWidth - margin * 2 });
        y += lineHeight;
    });

    return doc.output("datauristring");
}

async function importFromWebUrl(rawUrl) {
    const sourceUrl = normalizeWebUrl(rawUrl);
    const fullText = await fetchWebPageContent(sourceUrl);
    const title = extractTitleFromUrl(sourceUrl) || "网页文档";
    const content = fullText.slice(0, 30000);
    const description = content.replace(/\s+/g, " ").slice(0, 90) + (content.length > 90 ? "..." : "");

    let pdfDataUrl = "";
    let pdfWarning = "";
    try {
        pdfDataUrl = buildSimplePdfDataUrl(title, sourceUrl, content);
    } catch (_) {
        pdfDataUrl = "";
        pdfWarning = "PDF 引擎暂不可用，已导入网页正文";
    }

    return {
        title,
        description,
        content,
        image: "",
        updated: "刚刚导入",
        pinned: false,
        marked: false,
        sourceUrl,
        pdfDataUrl,
        pdfFileName: `${title.slice(0, 40) || "web-doc"}.pdf`,
        pdfWarning
    };
}

function collectAllDocuments() {
    const rows = [];
    Object.keys(topicDocuments).forEach((topic) => {
        (topicDocuments[topic] || []).forEach((doc, index) => {
            rows.push({ topic, doc, index });
        });
    });
    return rows;
}

function initSearch() {
    const input = document.getElementById("globalSearchInput") || document.querySelector(".search-bar input");
    if (!input) return;
    input.addEventListener("input", () => {
        const raw = input.value.trim();
        const keyword = raw.toLowerCase();
        if (!keyword) {
            loadTopicDocuments(currentTopic);
            return;
        }
        renderGlobalSearchResults(keyword);
    });
}

function renderGlobalSearchResults(keyword) {
    const grid = document.getElementById("documentGrid");
    if (!grid) return;
    const matches = collectAllDocuments().filter(({ doc }) => {
        const text = `${doc.title} ${doc.description} ${doc.content || ""}`.toLowerCase();
        return text.includes(keyword);
    });

    grid.innerHTML = "";
    if (matches.length === 0) {
        grid.innerHTML = `
            <div class="no-documents" style="grid-column: 1 / -1;">
                <div class="no-documents-icon">🔍</div>
                <h3>未找到匹配的文档</h3>
                <p>请尝试其他关键词，或清空搜索回到当前主题</p>
            </div>
        `;
        return;
    }

    matches.forEach(({ topic, doc, index }) => {
        const card = document.createElement("article");
        card.className = "document-card";
        card.dataset.index = String(index);
        card.dataset.topic = topic;
        card.innerHTML = `
            <span class="card-topic-badge">${topic}</span>
            ${doc.marked ? '<div class="mark-corner">!</div>' : ""}
            <h3 class="card-title">${doc.title}</h3>
            <p class="card-description">${doc.description}</p>
            ${doc.sourceUrl ? `<a class="card-source-link" href="${doc.sourceUrl}" target="_blank" rel="noopener noreferrer">原文链接</a>` : ""}
            <div class="card-footer">
                <span class="card-updated">${doc.updated}</span>
                <button class="card-menu-trigger" aria-label="文档操作">⋯</button>
            </div>
            <div class="card-menu-dropdown">
                <button class="menu-item" data-action="pin">${doc.pinned ? "取消置顶" : "置顶"}</button>
                <button class="menu-item" data-action="mark">${doc.marked ? "取消标记" : "标记"}</button>
                <button class="menu-item danger" data-action="delete">删除</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function initAiChat() {
    const input = document.getElementById("aiInput");
    const sendBtn = document.getElementById("aiSendBtn");
    if (!input || !sendBtn) return;

    const send = () => sendAiMessage();
    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") send();
    });
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderAssistantMessageHtml(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let inList = false;

    const closeListIfNeeded = () => {
        if (inList) {
            html.push("</ul>");
            inList = false;
        }
    };

    lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line) {
            closeListIfNeeded();
            return;
        }

        if (/^[-*•]\s+/.test(line)) {
            if (!inList) {
                html.push("<ul>");
                inList = true;
            }
            const item = escapeHtml(line.replace(/^[-*•]\s+/, ""))
                .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                .replace(/`([^`]+)`/g, "<code>$1</code>");
            html.push(`<li>${item}</li>`);
            return;
        }

        closeListIfNeeded();

        if (/^#{1,3}\s+/.test(line)) {
            const level = Math.min(3, line.match(/^#+/)[0].length);
            const title = escapeHtml(line.replace(/^#{1,3}\s+/, ""));
            html.push(`<h${level}>${title}</h${level}>`);
            return;
        }

        if (/^(-{3,}|_{3,}|\*{3,})$/.test(line)) {
            html.push("<hr>");
            return;
        }

        const paragraph = escapeHtml(line)
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/`([^`]+)`/g, "<code>$1</code>");
        html.push(`<p>${paragraph}</p>`);
    });

    closeListIfNeeded();
    return html.join("") || `<p>${escapeHtml(text)}</p>`;
}

function appendAiBubble(role, text, isError) {
    const box = document.getElementById("aiMessages");
    if (!box) return null;
    const wrap = document.createElement("div");
    wrap.className = `ai-bubble ${role === "user" ? "ai-bubble-user" : "ai-bubble-assistant"}${isError ? " ai-bubble-error" : ""}`;

    if (role === "assistant" && !isError) {
        wrap.innerHTML = renderAssistantMessageHtml(text);
    } else {
        const p = document.createElement("p");
        p.textContent = text;
        wrap.appendChild(p);
    }

    box.appendChild(wrap);
    box.scrollTop = box.scrollHeight;
    return wrap;
}

function showAiThinking() {
    const box = document.getElementById("aiMessages");
    if (!box) return null;
    const thinking = document.createElement("div");
    thinking.className = "ai-bubble ai-bubble-assistant ai-bubble-thinking";
    thinking.innerHTML = `
        <div class="thinking-row">
            <span>正在思考中</span>
            <span class="thinking-dots"><i></i><i></i><i></i></span>
        </div>
    `;
    box.appendChild(thinking);
    box.scrollTop = box.scrollHeight;
    return thinking;
}

async function sendAiMessage() {
    const input = document.getElementById("aiInput");
    let key = getDeepSeekApiKey();
    const text = (input?.value || "").trim();
    if (!text) return;

    if (!key) {
        const manualKey = prompt("请输入 DeepSeek API Key（仅保存在当前浏览器）", "");
        if (manualKey && manualKey.trim()) {
            try {
                localStorage.setItem("KNOWLINK_DEEPSEEK_KEY", manualKey.trim());
                showNotification("API Key 已保存到本地浏览器");
            } catch (_) {
                showNotification("浏览器不支持本地存储，请在页面脚本中设置 KEY");
            }
        }

        key = getDeepSeekApiKey();
        if (!key) {
            appendAiBubble(
                "assistant",
                "未检测到 DeepSeek 密钥。请在顶部脚本设置 window.KNOWLINK_DEEPSEEK_KEY，或在弹窗中输入后重试。",
                true
            );
            showNotification("未配置 DeepSeek API Key");
            return;
        }
    }

    appendAiBubble("user", text);
    if (input) input.value = "";

    aiChatHistory.push({ role: "user", content: text });
    const messages = [
        { role: "system", content: "你是 KnowLink 知识库助手，回答简洁、准确，使用简体中文。" },
        ...aiChatHistory.slice(-16).map((m) => ({ role: m.role, content: m.content }))
    ];

    let thinkingBubble = null;
    try {
        thinkingBubble = showAiThinking();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const res = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages,
                temperature: 0.6
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const errMsg = data.error?.message || data.message || `请求失败（${res.status}）`;
            throw new Error(errMsg);
        }
        const reply = data.choices?.[0]?.message?.content?.trim() || "（无回复内容）";
        aiChatHistory.push({ role: "assistant", content: reply });
        thinkingBubble?.remove();
        appendAiBubble("assistant", reply);
    } catch (err) {
        thinkingBubble?.remove();
        let msg = err instanceof Error ? err.message : String(err);
        if (err instanceof DOMException && err.name === "AbortError") {
            msg = "请求超时：请检查网络后重试。";
        } else if (/Failed to fetch/i.test(msg)) {
            msg = "网络请求失败：请检查网络、API Key，或确认浏览器未拦截跨域请求。";
        }
        appendAiBubble("assistant", msg, true);
        aiChatHistory.pop();
    }
}

function initAiHeaderToggle() {
    const toggleBtn = document.querySelector(".ai-btn");
    const aiPanel = document.getElementById("aiAssistantPanel");
    const mindPanel = document.getElementById("mindTreePanel");
    if (!toggleBtn || !aiPanel || !mindPanel) return;

    toggleBtn.addEventListener("click", () => {
        aiPanel.classList.toggle("collapsed");
        const hidden = aiPanel.classList.contains("collapsed");
        mindPanel.classList.toggle("mind-tree-expanded", hidden);
    });
}

function initPanelResizer() {
    const resizer = document.getElementById("panelResizer");
    const rightSidebar = document.querySelector(".right-sidebar");
    if (!resizer || !rightSidebar) return;

    let dragging = false;
    resizer.addEventListener("mousedown", () => {
        dragging = true;
        resizer.classList.add("dragging");
    });

    document.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const minWidth = 260;
        const maxWidth = 560;
        const rightWidth = window.innerWidth - e.clientX;
        rightSidebar.style.width = `${Math.max(minWidth, Math.min(maxWidth, rightWidth))}px`;
    });

    document.addEventListener("mouseup", () => {
        dragging = false;
        resizer.classList.remove("dragging");
    });
}

function mindScreenToWorld(clientX, clientY) {
    const viewport = document.getElementById("mindTreeViewport");
    if (!viewport) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    return {
        x: (mx - mindView.x) / mindView.scale,
        y: (my - mindView.y) / mindView.scale
    };
}

function applyMindViewTransform() {
    const world = document.getElementById("mindTreeWorld");
    if (!world) return;
    world.style.transform = `translate(${mindView.x}px, ${mindView.y}px) scale(${mindView.scale})`;
    const label = document.getElementById("zoomLevelLabel");
    if (label) label.textContent = `${Math.round(mindView.scale * 100)}%`;
}

function handleMindGlobalPointerMove(e) {
    if (mindPanning && mindPanStart) {
        mindView.x = mindPanStart.vx + (e.clientX - mindPanStart.sx);
        mindView.y = mindPanStart.vy + (e.clientY - mindPanStart.sy);
        applyMindViewTransform();
        return;
    }
    if (!draggingMindNodeId) return;
    const target = mindNodes.find((n) => n.id === draggingMindNodeId);
    if (!target) return;
    const w = mindScreenToWorld(e.clientX, e.clientY);
    target.x = w.x - mindDragOffset.x;
    target.y = w.y - mindDragOffset.y;
    renderMindTree();
}

function handleMindGlobalPointerUp() {
    const viewport = document.getElementById("mindTreeViewport");
    if (mindPanning && viewport) viewport.classList.remove("is-panning");
    mindPanning = false;
    mindPanStart = null;
    if (draggingMindNodeId) saveCurrentMindTree();
    draggingMindNodeId = null;
}

function initMindViewportControls() {
    const viewport = document.getElementById("mindTreeViewport");
    if (!viewport || initMindViewportControls._done) return;
    initMindViewportControls._done = true;

    const zoomAt = (nextScale, anchorX, anchorY) => {
        const rect = viewport.getBoundingClientRect();
        const mx = typeof anchorX === "number" ? anchorX : rect.width / 2;
        const my = typeof anchorY === "number" ? anchorY : rect.height / 2;
        const wx = (mx - mindView.x) / mindView.scale;
        const wy = (my - mindView.y) / mindView.scale;
        mindView.scale = nextScale;
        mindView.x = mx - wx * mindView.scale;
        mindView.y = my - wy * mindView.scale;
        applyMindViewTransform();
    };

    viewport.addEventListener(
        "wheel",
        (e) => {
            e.preventDefault();
            const rect = viewport.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const worldX = (mx - mindView.x) / mindView.scale;
            const worldY = (my - mindView.y) / mindView.scale;
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const next = Math.min(MIND_SCALE_MAX, Math.max(MIND_SCALE_MIN, mindView.scale + delta));
            mindView.scale = next;
            mindView.x = mx - worldX * mindView.scale;
            mindView.y = my - worldY * mindView.scale;
            applyMindViewTransform();
        },
        { passive: false }
    );

    viewport.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        if (e.target.closest(".mind-node")) return;
        if (e.target.closest(".tree-zoom-bar")) return;
        mindPanning = true;
        mindPanStart = { sx: e.clientX, sy: e.clientY, vx: mindView.x, vy: mindView.y };
        viewport.classList.add("is-panning");
    });

    viewport.addEventListener("dblclick", (e) => {
        if (e.target.closest(".mind-node")) return;
        if (e.target.closest(".tree-zoom-bar")) return;
        const text = prompt("节点名称", "新节点");
        if (!text) return;
        const w = mindScreenToWorld(e.clientX, e.clientY);
        mindNodes.push({
            id: uid(),
            text: text.trim(),
            x: w.x - 40,
            y: w.y - 16,
            parentId: null
        });
        saveCurrentMindTree();
        renderMindTree();
    });

    const zoomInBtn = document.getElementById("zoomInBtn");
    const zoomOutBtn = document.getElementById("zoomOutBtn");
    const resetViewBtn = document.getElementById("resetViewBtn");
    if (zoomInBtn) {
        zoomInBtn.addEventListener("click", () => {
            const next = Math.min(MIND_SCALE_MAX, mindView.scale + 0.18);
            zoomAt(next);
        });
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener("click", () => {
            const next = Math.max(MIND_SCALE_MIN, mindView.scale - 0.18);
            zoomAt(next);
        });
    }
    if (resetViewBtn) {
        resetViewBtn.addEventListener("click", () => {
            mindView = { x: 40, y: 36, scale: 1 };
            applyMindViewTransform();
        });
    }
}

function initMindTreeEditor() {
    const world = document.getElementById("mindTreeWorld");
    const addNodeBtn = document.getElementById("addNodeBtn");
    const addChildBtn = document.getElementById("addChildBtn");
    const deleteBtn = document.getElementById("deleteNodeBtn");
    const resetBtn = document.getElementById("resetMindTreeBtn");
    if (!world) return;

    const seedMindTree = () => {
        mindNodes = [
            { id: "root", text: currentTopic, x: 160, y: 80, parentId: null },
            { id: uid(), text: "基础模型", x: 60, y: 180, parentId: "root" },
            { id: uid(), text: "演化框架", x: 260, y: 180, parentId: "root" }
        ];
        selectedMindNodeId = "root";
        saveCurrentMindTree();
        renderMindTree();
    };

    if (!mindTreeInitialized) {
        Object.keys(topicDocuments).forEach((topic) => {
            if (!mindTreeByTopic[topic]) {
                mindTreeByTopic[topic] = [{ id: "root", text: topic, x: 160, y: 80, parentId: null }];
            }
        });
        seedMindTree();
    }
    if (mindTreeInitialized) return;
    mindTreeInitialized = true;

    if (!mindGlobalHandlersBound) {
        mindGlobalHandlersBound = true;
        document.addEventListener("mousemove", handleMindGlobalPointerMove);
        document.addEventListener("mouseup", handleMindGlobalPointerUp);
    }
    initMindViewportControls();

    if (addNodeBtn) {
        addNodeBtn.addEventListener("click", () => {
            mindNodes.push({ id: uid(), text: "新节点", x: 120, y: 120, parentId: null });
            saveCurrentMindTree();
            renderMindTree();
        });
    }

    if (addChildBtn) {
        addChildBtn.addEventListener("click", () => {
            if (!selectedMindNodeId) {
                showNotification("请先选中一个节点");
                return;
            }
            const parent = mindNodes.find((n) => n.id === selectedMindNodeId);
            if (!parent) return;
            mindNodes.push({
                id: uid(),
                text: "子节点",
                x: parent.x + 120,
                y: parent.y + 70,
                parentId: parent.id
            });
            saveCurrentMindTree();
            renderMindTree();
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener("click", () => {
            if (!selectedMindNodeId) return;
            const idsToDelete = collectMindDescendants(selectedMindNodeId);
            mindNodes = mindNodes.filter((n) => !idsToDelete.includes(n.id));
            selectedMindNodeId = null;
            saveCurrentMindTree();
            renderMindTree();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", () => seedMindTree());
    }
}

function saveCurrentMindTree() {
    mindTreeByTopic[currentTopic] = mindNodes.map((node) => ({ ...node }));
}

function loadMindTreeForTopic(topicName) {
    const stored = mindTreeByTopic[topicName];
    if (!stored || stored.length === 0) {
        mindNodes = [{ id: "root", text: topicName, x: 160, y: 80, parentId: null }];
    } else {
        mindNodes = stored.map((node) => ({ ...node }));
    }
    selectedMindNodeId = mindNodes[0]?.id || null;
    renderMindTree();
}

function renderMindTree() {
    const world = document.getElementById("mindTreeWorld");
    if (!world) return;
    world.innerHTML = "";

    mindNodes.forEach((node) => {
        if (!node.parentId) return;
        const parent = mindNodes.find((n) => n.id === node.parentId);
        if (!parent) return;
        const x1 = parent.x + 45;
        const y1 = parent.y + 14;
        const x2 = node.x + 45;
        const y2 = node.y + 14;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        const line = document.createElement("div");
        line.className = "mind-connector";
        line.style.left = `${x1}px`;
        line.style.top = `${y1}px`;
        line.style.width = `${length}px`;
        line.style.transform = `rotate(${angle}deg)`;
        world.appendChild(line);
    });

    mindNodes.forEach((node) => {
        const el = document.createElement("div");
        el.className = "mind-node";
        if (node.id === selectedMindNodeId) el.classList.add("selected");
        el.dataset.id = node.id;
        el.textContent = node.text;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        world.appendChild(el);

        el.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedMindNodeId = node.id;
            renderMindTree();
        });
        el.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            const text = prompt("修改节点名称", node.text);
            if (!text) return;
            node.text = text.trim();
            saveCurrentMindTree();
            renderMindTree();
        });
        el.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            draggingMindNodeId = node.id;
            const w = mindScreenToWorld(e.clientX, e.clientY);
            mindDragOffset = { x: w.x - node.x, y: w.y - node.y };
        });
    });

    applyMindViewTransform();
}

function collectMindDescendants(id) {
    const result = [id];
    const queue = [id];
    while (queue.length) {
        const cur = queue.shift();
        mindNodes.filter((n) => n.parentId === cur).forEach((child) => {
            result.push(child.id);
            queue.push(child.id);
        });
    }
    return result;
}

function uid() {
    return Math.random().toString(36).slice(2, 9);
}

function loadTopicDocuments(topicName) {
    const grid = document.getElementById("documentGrid");
    if (!grid) return;
    const documents = [...(topicDocuments[topicName] || [])].sort((a, b) => Number(b.pinned) - Number(a.pinned));

    grid.innerHTML = "";
    if (documents.length === 0) {
        grid.innerHTML = `
            <div class="no-documents">
                <div class="no-documents-icon">📄</div>
                <h3>暂无文档</h3>
                <p>该主题下还没有上传文档</p>
                <button class="upload-btn" id="openUploadInEmpty">上传文档</button>
            </div>
        `;
        const btn = document.getElementById("openUploadInEmpty");
        if (btn) btn.addEventListener("click", openUploadModal);
        return;
    }

    documents.forEach((doc) => {
        const realIndex = (topicDocuments[topicName] || []).indexOf(doc);
        const card = document.createElement("article");
        card.className = "document-card";
        card.dataset.index = String(realIndex);
        card.innerHTML = `
            ${doc.marked ? '<div class="mark-corner">!</div>' : ""}
            <h3 class="card-title">${doc.title}</h3>
            <p class="card-description">${doc.description}</p>
            ${doc.sourceUrl ? `<a class="card-source-link" href="${doc.sourceUrl}" target="_blank" rel="noopener noreferrer">原文链接</a>` : ""}
            <div class="card-footer">
                <span class="card-updated">${doc.updated}</span>
                <button class="card-menu-trigger" aria-label="文档操作">⋯</button>
            </div>
            <div class="card-menu-dropdown">
                <button class="menu-item" data-action="pin">${doc.pinned ? "取消置顶" : "置顶"}</button>
                <button class="menu-item" data-action="mark">${doc.marked ? "取消标记" : "标记"}</button>
                <button class="menu-item danger" data-action="delete">删除</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function expandDocument(index) {
    const grid = document.getElementById("documentGrid");
    const docs = topicDocuments[currentTopic] || [];
    const doc = docs[index];
    if (!grid || !doc) return;

    currentExpandedDocIndex = index;
    grid.innerHTML = `
        <div class="expanded-document">
            <button class="back-btn" id="backToCards">← 返回卡片</button>
            <div class="document-header">
                <h2>${doc.title}</h2>
                <span class="update-time">${doc.updated}</span>
            </div>
            ${doc.sourceUrl ? `<div class="document-meta-links"><a class="document-source-link" href="${doc.sourceUrl}" target="_blank" rel="noopener noreferrer">查看原网页</a></div>` : ""}
            ${doc.pdfDataUrl ? `<div class="document-meta-links"><a class="document-pdf-link" href="${doc.pdfDataUrl}" download="${doc.pdfFileName || "web-page.pdf"}">下载转存 PDF</a></div>` : ""}
            ${doc.image ? `<div class="document-image-large"><img src="${doc.image}" alt="${doc.title}"></div>` : ""}
            <div class="document-content">
                ${(doc.content || doc.description).split("\n").map((line) => `<p>${line}</p>`).join("")}
            </div>
        </div>
    `;
    const backBtn = document.getElementById("backToCards");
    if (backBtn) backBtn.addEventListener("click", () => {
        currentExpandedDocIndex = null;
        loadTopicDocuments(currentTopic);
    });
}

function openUploadModal() {
    const modal = document.getElementById("quickImportModal");
    if (modal) {
        const topicSelect = document.getElementById("topicSelect");
        if (topicSelect && [...topicSelect.options].some((opt) => opt.value === currentTopic)) {
            topicSelect.value = currentTopic;
        }
        modal.classList.add("show");
    }
}

function initSwipeActions() {
    document.querySelectorAll(".topic-item").forEach((item) => {
        item.onmousedown = null;
        item.onmousemove = null;
        item.onmouseup = null;
        item.ontouchstart = null;
        item.ontouchmove = null;
        item.ontouchend = null;

        item.addEventListener("touchstart", handleTouchStart, { passive: true });
        item.addEventListener("touchmove", handleTouchMove, { passive: true });
        item.addEventListener("touchend", handleTouchEnd, { passive: true });
        item.addEventListener("mousedown", handleMouseDown);
        item.addEventListener("mousemove", handleMouseMove);
        item.addEventListener("mouseup", handleMouseUp);
        item.addEventListener("mouseleave", handleMouseUp);

        const pinBtn = item.querySelector(".pin-btn");
        const editBtn = item.querySelector(".edit-btn");
        if (pinBtn) {
            pinBtn.onclick = (e) => {
                e.stopPropagation();
                togglePinTopic(item);
            };
        }
        if (editBtn) {
            editBtn.onclick = (e) => {
                e.stopPropagation();
                openEditModal(item);
            };
        }
    });
}

function handleTouchStart(e) {
    startX = e.touches[0].clientX;
    currentX = startX;
    isDragging = true;
    hasMoved = false;
    this.style.transition = "none";
}

function handleTouchMove(e) {
    if (!isDragging) return;
    currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    if (Math.abs(diff) > 8) hasMoved = true;
    if (diff < 0 && diff > -90) this.style.transform = `translateX(${diff}px)`;
}

function handleTouchEnd() {
    finishDrag.call(this);
}

function handleMouseDown(e) {
    startX = e.clientX;
    currentX = startX;
    isDragging = true;
    hasMoved = false;
    this.style.transition = "none";
}

function handleMouseMove(e) {
    if (!isDragging) return;
    currentX = e.clientX;
    const diff = currentX - startX;
    if (Math.abs(diff) > 8) hasMoved = true;
    if (diff < 0 && diff > -90) this.style.transform = `translateX(${diff}px)`;
}

function handleMouseUp() {
    finishDrag.call(this);
}

function finishDrag() {
    if (!isDragging) return;
    isDragging = false;
    const diff = currentX - startX;
    this.style.transition = "transform 0.25s ease";

    document.querySelectorAll(".topic-item").forEach((item) => {
        if (item !== this) {
            item.style.transform = "translateX(0)";
            item.classList.remove("swipe-left");
        }
    });

    if (diff < -30) {
        this.style.transform = "translateX(-64px)";
        this.classList.add("swipe-left");
        openTopicActionItem = this;
    } else {
        this.style.transform = "translateX(0)";
        this.classList.remove("swipe-left");
        openTopicActionItem = null;
    }
}

function togglePinTopic(item) {
    const list = document.getElementById("knowledgeList");
    if (!list) return;
    item.classList.toggle("pinned");
    if (item.classList.contains("pinned")) {
        list.prepend(item);
        showNotification("主题已置顶");
    } else {
        list.appendChild(item);
        showNotification("已取消置顶");
    }
    item.style.transform = "translateX(0)";
    item.classList.remove("swipe-left");
}

function openEditModal(item) {
    currentEditItem = item;
    const editModal = document.getElementById("editTopicModal");
    const nameInput = document.getElementById("editTopicName");
    const descInput = document.getElementById("editTopicDescription");
    const icon = item.querySelector(".icon")?.textContent || "📚";
    const name = getTopicName(item);
    const desc = item.dataset.description || "";

    if (!editModal || !nameInput || !descInput) return;
    nameInput.value = name;
    descInput.value = desc;
    document.querySelector("#editTopicModal .char-count").textContent = `${desc.length}/50`;

    editModal.querySelectorAll(".icon-option").forEach((opt) => {
        opt.classList.toggle("selected", opt.textContent === icon);
        opt.onclick = () => {
            editModal.querySelectorAll(".icon-option").forEach((o) => o.classList.remove("selected"));
            opt.classList.add("selected");
        };
    });

    editModal.classList.add("show");
}

function saveEditTopic() {
    if (!currentEditItem) return;
    const nameInput = document.getElementById("editTopicName");
    const descInput = document.getElementById("editTopicDescription");
    const iconOption = document.querySelector("#editTopicModal .icon-option.selected");
    if (!nameInput || !descInput) return;

    const oldName = getTopicName(currentEditItem);
    const newName = nameInput.value.trim();
    if (!newName) {
        alert("请输入主题名称");
        return;
    }
    if (newName !== oldName && topicDocuments[newName]) {
        alert("主题名称已存在");
        return;
    }

    currentEditItem.querySelector(".topic-name").textContent = newName;
    currentEditItem.querySelector(".icon").textContent = iconOption ? iconOption.textContent : "📚";
    currentEditItem.dataset.description = descInput.value.trim();
    currentEditItem.title = descInput.value.trim();

    if (newName !== oldName) {
        topicDocuments[newName] = topicDocuments[oldName] || [];
        delete topicDocuments[oldName];
        mindTreeByTopic[newName] = mindTreeByTopic[oldName] || [{ id: "root", text: newName, x: 160, y: 80, parentId: null }];
        delete mindTreeByTopic[oldName];
        if (mindTreeByTopic[newName][0]) {
            mindTreeByTopic[newName][0].text = newName;
        }
        if (currentTopic === oldName) currentTopic = newName;
    }

    syncTopicSelectOptions();
    closeModal(document.getElementById("editTopicModal"));
    showNotification("主题已更新");
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".topic-item") && openTopicActionItem) {
        openTopicActionItem.style.transform = "translateX(0)";
        openTopicActionItem.classList.remove("swipe-left");
        openTopicActionItem = null;
    }

    const menuBtn = e.target.closest(".card-menu-trigger");
    const card = e.target.closest(".document-card");
    const menuItem = e.target.closest(".menu-item");

    if (menuBtn && card) {
        e.stopPropagation();
        toggleCardMenu(card);
        return;
    }

    if (menuItem && card) {
        e.stopPropagation();
        handleCardMenuAction(card, menuItem.dataset.action);
        return;
    }

    if (e.target.closest(".card-source-link") || e.target.closest(".document-source-link") || e.target.closest(".document-pdf-link")) {
        return;
    }

    if (card && !e.target.closest(".card-menu-dropdown")) {
        const index = Number(card.dataset.index);
        const topic = card.dataset.topic;
        if (topic) {
            currentTopic = topic;
            syncNavActiveTopic(topic);
            const searchInput = document.getElementById("globalSearchInput");
            if (searchInput) searchInput.value = "";
        }
        expandDocument(index);
        return;
    }

    if (!e.target.closest(".document-card")) {
        closeCardMenus();
    }
});

function toggleCardMenu(card) {
    const menu = card.querySelector(".card-menu-dropdown");
    if (!menu) return;
    if (openCardMenu && openCardMenu !== menu) openCardMenu.classList.remove("show");
    menu.classList.toggle("show");
    openCardMenu = menu.classList.contains("show") ? menu : null;
}

function closeCardMenus() {
    document.querySelectorAll(".card-menu-dropdown.show").forEach((menu) => menu.classList.remove("show"));
    openCardMenu = null;
}

function refreshSearchOrTopicView() {
    const input = document.getElementById("globalSearchInput");
    const kw = (input?.value || "").trim().toLowerCase();
    if (kw) renderGlobalSearchResults(kw);
    else loadTopicDocuments(currentTopic);
}

function handleCardMenuAction(card, action) {
    const index = Number(card.dataset.index);
    const topic = card.dataset.topic || currentTopic;
    const docs = topicDocuments[topic] || [];
    const doc = docs[index];
    if (!doc) return;

    if (action === "pin") {
        doc.pinned = !doc.pinned;
        showNotification(doc.pinned ? "文档已置顶" : "已取消置顶");
    } else if (action === "mark") {
        doc.marked = !doc.marked;
        showNotification(doc.marked ? "文档已标记" : "已取消标记");
    } else if (action === "delete") {
        if (!confirm("确定删除这篇文档吗？")) return;
        docs.splice(index, 1);
        showNotification("文档已删除");
    }

    currentExpandedDocIndex = null;
    closeCardMenus();
    if (card.dataset.topic) currentTopic = topic;
    refreshSearchOrTopicView();
}

function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1976d2;
        color: #fff;
        padding: 10px 16px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 9999;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2200);
}
