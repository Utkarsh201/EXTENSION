
// Global Variable Declaration

let lastUrl = ""
let problemDetails = {}
let XhrRequestData = ""
let scriptInjected = false; // Guard to inject XHR hook only once
const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
recognition.lang = 'en-IN';
recognition.continuous = false;
recognition.interimResults = false;

// Helper: check if extension context is still valid
function isExtensionContextValid() {
  try {
    return !!chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}


// Mutation observe and function to detect page change , and problem page

function areRequiredElementsLoaded() {
  const problemTitle = (
    document.querySelector('h4.font-rubik, h4[class*="text-fg-grey-primary"]') ||
    document.querySelector('[class*="coding_problem_info_heading"]') ||
    document.querySelector('h4, h1, h2, h3')
  )?.textContent?.trim();

  const problemContent = (
    document.querySelector('#app-layout-scroll') ||
    document.querySelector('section.space-y-2') ||
    document.querySelector('[class*="@container"]') ||
    document.querySelector('[class*="coding_desc"]') ||
    document.querySelector('[class*="problem_paragraph"]') ||
    document.querySelector('section')
  );

  return !!(problemTitle && problemContent);
}

function isUrlChanged() {
  const currentUrl = window.location.pathname;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    return true;
  }
  return false;
}

function isProblemsPage() {
  const pathParts = window.location.pathname.split("/");
  return pathParts.length >= 3 && pathParts[1] === "problems" && pathParts[2];
}

const observer = new MutationObserver((mutations) => {

  // If extension context is invalidated (e.g. extension reloaded), stop observing
  if (!isExtensionContextValid()) {
    observer.disconnect();
    return;
  }

  // Inject XHR hook only once
  if (!scriptInjected) {
    injectScript();
  }

  for (const mutation of mutations) {
    if (mutation.type === "childList" && isProblemsPage()) {
      if (isUrlChanged() || !document.getElementById("help-button")) {
       
        if (areRequiredElementsLoaded()) {
          cleanElements();
          createElement();
        }
      }
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Mutation Observer Done

// Elements related functions

function createElement() {
  if (document.getElementById("help-button")) return;

  // Locate the problem title element
  const titleEl = 
    document.querySelector('h4.font-rubik, h4[class*="text-fg-grey-primary"]') ||
    document.querySelector('h4') ||
    document.querySelector('[class*="coding_problem_info_heading"]') ||
    document.querySelector('h1, h2, h3');

  // Find the flex container that wraps the title (e.g., div.flex.justify-between)
  let targetContainer = titleEl?.closest('.justify-between') ||
                        titleEl?.closest('.flex-wrap') ||
                        titleEl?.closest('.flex') ||
                        titleEl?.parentElement;

  // Fallbacks if header flex container is not found directly
  if (!targetContainer) {
    targetContainer = 
      document.querySelector('.w-100.d-flex.align-items-center.flex-wrap.gap-2.justify-content-between') ||
      document.querySelector('.flex.w-full.min-w-0.items-center.justify-between') ||
      document.querySelector('#app-layout-scroll');
  }

  if (!targetContainer) {
    return;
  }

  const helpButton = createHelpButton();

  // If the target container contains the title, append helpButton (flex justify-between aligns it to the right)
  if (titleEl && targetContainer.contains(titleEl)) {
    targetContainer.appendChild(helpButton);
  } else {
    targetContainer.appendChild(helpButton);
  }

  helpButton.addEventListener("click", openChatBox);
}

function createButtonContainer() {
  const buttonContainer = document.createElement("div");
  buttonContainer.id = "button-container";
  buttonContainer.style.display = "flex";
  buttonContainer.style.justifyContent = "flex-end";
  buttonContainer.style.gap = "10px";
  return buttonContainer;
}

function createHelpButton() {
  const helpButton = document.createElement("button");
  helpButton.id = "help-button";
  helpButton.setAttribute("type", "button");

  helpButton.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
    transition: all 0.2s ease;
    height: 34px;
    line-height: 1;
    user-select: none;
    flex-shrink: 0;
  `;

  helpButton.onmouseenter = () => {
    helpButton.style.transform = "translateY(-1px)";
    helpButton.style.boxShadow = "0 4px 14px rgba(99, 102, 241, 0.55)";
    helpButton.style.filter = "brightness(1.1)";
  };
  helpButton.onmouseleave = () => {
    helpButton.style.transform = "none";
    helpButton.style.boxShadow = "0 2px 8px rgba(99, 102, 241, 0.35)";
    helpButton.style.filter = "none";
  };

  helpButton.innerHTML = `
    <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" height="16" width="16" xmlns="http://www.w3.org/2000/svg">
      <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h8M8 14h4m5 5l-3-3H6a2 2 0 01-2-2V7a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-3l-3 3z"></path>
    </svg>
    <span>Ask Doubt</span>
  `;

  return helpButton;
}

function cleanElements() {
  const helpButton = document.getElementById("help-button");
  if (helpButton) helpButton.remove();

  const buttonContainer = document.getElementById("button-container");
  if (buttonContainer) buttonContainer.remove();

  const modalContainer = document.getElementById("modalContainer") || document.getElementById("modal-container");
  if (modalContainer) modalContainer.remove();
  problemDetails = {};
}
// Elements related function done

// Extracting Problem Details

function extractProblemDetails() {
  let parsedData = {};
  if (XhrRequestData && XhrRequestData.response) {
    try {
      parsedData = JSON.parse(XhrRequestData.response)?.data || {};
    } catch (error) {
      console.warn("Could not parse XHR response, falling back to page DOM:", error);
      parsedData = {};
    }
  }

  const primaryDetails = {
    title: parsedData?.title || "",
    description: parsedData?.body || "",
    constraints: parsedData?.constraints || "",
    editorialCode: parsedData?.editorial_code || [],
    hints: parsedData?.hints || {},
    id: (parsedData?.id != null) ? parsedData.id.toString() : "",
    inputFormat: parsedData?.input_format || "",
    note: parsedData?.note || "",
    outputFormat: parsedData?.output_format || "",
    samples: parsedData?.samples || [],
  };

  const inputFormatEls = document.querySelectorAll('[class*="coding_input_format"]');
  const titleElement = 
    document.querySelector('h4.font-rubik, h4[class*="text-fg-grey-primary"]') ||
    document.querySelector('h4') ||
    document.querySelector('[class*="Header_resource_heading"]') || 
    document.querySelector('[class*="coding_problem_info_heading"]') ||
    document.querySelector('h1, h2, h3');

  const descElement = 
    document.querySelector('[class*="coding_desc"]') ||
    document.querySelector('#app-layout-scroll') ||
    document.querySelector('section');

  const fallbackDetails = {
    id: extractProblemNumber(),
    title: titleElement?.textContent?.trim() || "",
    description: descElement?.textContent?.trim() || "",
    inputFormat: inputFormatEls[0]?.textContent || "",
    outputFormat: inputFormatEls[1]?.textContent || "",
    constraints: inputFormatEls[2]?.textContent || "",
    note: inputFormatEls[3]?.textContent || "",
    inputOutput: extractInputOutput() || [],
    userCode: extractUserCode() || "",
  };

  problemDetails = {
    title: primaryDetails?.title || fallbackDetails?.title,
    description: primaryDetails?.description || fallbackDetails?.description,
    constraints: primaryDetails?.constraints || fallbackDetails?.constraints,
    editorialCode: primaryDetails?.editorialCode || [],
    hints: primaryDetails?.hints || {},
    problemId: primaryDetails?.id || fallbackDetails?.id,
    inputFormat: primaryDetails?.inputFormat || fallbackDetails?.inputFormat,
    note: primaryDetails?.note || fallbackDetails?.note,
    outputFormat: primaryDetails?.outputFormat || fallbackDetails?.outputFormat,
    samples: primaryDetails?.samples || fallbackDetails?.inputOutput,
    userCode: fallbackDetails?.userCode || "",
  };
}

function extractProblemNumber() {
  const url = window.location.pathname
  const parts = url.split('/');
  let lastPart = parts[parts.length - 1];

  let number = '';
  for (let i = lastPart.length - 1; i >= 0; i--) {
    if (isNaN(lastPart[i])) {
      break;
    }
    number = lastPart[i] + number;
  }

  return number;
}

function extractUserCode() {

  let localStorageData = extractLocalStorage();

  const problemNo = extractProblemNumber();
  let language = localStorageData['editor-language'] || "C++14";
  if (language.startsWith('"') && language.endsWith('"')) {
    language = language.slice(1, -1);
  }

  const expression = createExpression(problemNo, language);
  for (let key in localStorageData) {
    if (
      localStorageData.hasOwnProperty(key) &&
      key.includes(expression) &&
      key.endsWith(expression)
    ) {
      return localStorageData[key];
    }
  }
  return '';
}

function createExpression(problemNo, language) {
  return `_${problemNo}_${language}`
}


function extractLocalStorage() {
  const localStorageData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    localStorageData[key] = localStorage.getItem(key);
  }
  return localStorageData;
}

function extractInputOutput() {

  const elements = document.querySelectorAll(".coding_input_format__pv9fS");
  const inputOutputPairs = [];

  for (let i = 3; i < elements.length; i += 2) {
    if (i + 1 < elements.length) {
      const input = elements[i]?.textContent?.trim() || "";
      const output = elements[i + 1]?.textContent?.trim() || "";
      inputOutputPairs.push({ input, output });
    }
  }

  let jsonString = formatToJson(inputOutputPairs)
  return jsonString.replace(/\\\\n/g, "\\n");

}

function formatToJson(obj) {
  return JSON.stringify(obj)
}

// Problem Details Extraction Done

// Chat Box Setup Start

function openChatBox() {
  let aiModal = document.getElementById("modalContainer");
  extractProblemDetails();
  aiModal = createModal();
  displayMessages(problemDetails.problemId)

  const closeAIBtn = aiModal.querySelector("#closeAIBtn");
  closeAIBtn.addEventListener("click", closeModal);

  attachEventListeners();

}

function createModal() {
  const modalHtml = `
    <div id="modalContainer" style="position: fixed; inset: 0; z-index: 999999; display: flex; align-items: center; justify-content: center; background-color: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); padding: 16px; box-sizing: border-box;">
      <div style="width: 100%; max-width: 760px; height: 86vh; max-height: 720px; background: #0f172a; border: 1px solid #334155; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6); display: flex; flex-direction: column; overflow: hidden; position: relative; font-family: system-ui, -apple-system, sans-serif;">
        
        <!-- Header -->
        <div style="padding: 16px 20px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; background: #0f172a;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #6366f1, #a855f7); display: flex; align-items: center; justify-content: center; color: white;">
              <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" height="18" width="18" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h8M8 14h4m5 5l-3-3H6a2 2 0 01-2-2V7a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-3l-3 3z"></path>
              </svg>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #f8fafc; line-height: 1.2;">
                AI Doubt Assistant
              </h2>
              <span style="font-size: 12px; color: #94a3b8;">${problemDetails.title || "Coding Mentor"}</span>
            </div>
          </div>
          
          <button type="button" id="closeAIBtn" style="background: transparent; border: none; color: #94a3b8; font-size: 24px; line-height: 1; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: color 0.2s;" title="Close">
            &times;
          </button>
        </div>

        <!-- Action Bar -->
        <div style="display: flex; justify-content: flex-end; gap: 8px; padding: 10px 16px; background: #131b2e; border-bottom: 1px solid #1e293b;">
          <button type="button" id="delete-button" style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; background: #1e293b; color: #f87171; border: 1px solid #334155; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
            <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" height="14" width="14" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7H5m4-3h6a1 1 0 0 1 1 1v1M9 4h6m4 3v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7h14zM10 11v6m4-6v6" />
            </svg>
            <span>Delete History</span>
          </button>
          <button type="button" id="export-chat-button" style="display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; background: #1e293b; color: #38bdf8; border: 1px solid #334155; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
            <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" height="14" width="14" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 5v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 2v6m-3 4h6" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 16h6" />
            </svg>
            <span>Export Chat</span>
          </button>
        </div>

        <!-- Chat Display -->
        <div id="chatBox" style="flex: 1; min-height: 250px; background: #0f172a; overflow-y: auto; padding: 16px; scroll-behavior: smooth;">
          <!-- Chat messages appear here -->
        </div>

        <!-- User Input Section -->
        <div style="padding: 12px 16px; background: #131b2e; border-top: 1px solid #1e293b; display: flex; align-items: center; gap: 10px;">
          <textarea id="userMessage" placeholder="Ask your doubt about this problem (Press Enter to send)..." rows="1" style="flex: 1; resize: none; background: #1e293b; color: #f8fafc; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; font-family: inherit; font-size: 13px; outline: none; line-height: 1.4; box-sizing: border-box;"></textarea>
          
          <button type="button" id="voiceType" style="width: 38px; height: 38px; border-radius: 8px; background: #1e293b; border: 1px solid #334155; color: #94a3b8; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;" title="Voice Input">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" height="20" width="20">
              <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"/>
              <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5"/>
            </svg>
          </button>

          <button type="button" id="sendMsg" style="width: 38px; height: 38px; border-radius: 8px; background: linear-gradient(135deg, #6366f1, #a855f7); border: none; color: #ffffff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);" title="Send Message">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" height="18" width="18">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 2L11 12M21 2L15 21l-4-9-9-4 12-4L21 2z"></path>
            </svg>
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  return document.getElementById('modalContainer');
}

function attachEventListeners() {
  document.getElementById('delete-button')?.addEventListener('click', deleteChatHistory);
  document.getElementById('export-chat-button')?.addEventListener('click', exportChat);
  document.getElementById('sendMsg')?.addEventListener('click', sendMessage);
  document.getElementById('voiceType')?.addEventListener('click', startListening);

  // Close when clicking overlay backdrop
  const modalContainer = document.getElementById('modalContainer');
  modalContainer?.addEventListener('click', (e) => {
    if (e.target === modalContainer) {
      closeModal();
    }
  });

  // Enter to send
  const textarea = document.getElementById('userMessage');
  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function closeModal() {
  const modal = document.getElementById('modalContainer');
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  if (modal) modal.remove();
}

// Chat Box Setup Done


// Delete and Export start

function deleteChatHistory() {
  const chatBox = document.getElementById('chatBox');
  const textArea = document.getElementById('userMessage')
  textArea.innerHTML = '';
  chatBox.innerHTML = '';
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  deleteChatHistoryStorage(problemDetails.problemId)

}

async function exportChat() {

  const id = problemDetails.problemId;
  const messages = await getChatHistory(id);

  if (messages) {

    let formattedMessages = [];

    messages.forEach((message) => {
      let messageText = message.parts[0]?.text;
      messageText = messageText
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/<\/?[^>]+(>|$)/g, "");
      if (messageText) {
        if (message.role === "user") {

          formattedMessages.push(`You: ${messageText}`);
        } else if (message.role === "model") {
          formattedMessages.push(`AI: ${messageText}`);
        }
      }
    });

    const chatHistory = formattedMessages.join('\n\n');

    const blob = new Blob([chatHistory], { type: 'text/plain' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `chat-history-of-${problemDetails?.title || "problem-statement"}.txt`;
    link.click();
  }
}

// Delete and Export end


function convertMarkdownToHTML(markdownText) {
  const htmlContent = marked.parse(markdownText);
  return htmlContent;
}

// Message Setup Start


async function sendMessage() {
  const userMessage = document.getElementById('userMessage').value.trim();
  const chatBox = document.getElementById('chatBox');
  const apiKey = await getApiKey();

  if (!apiKey) {
    alert("No API key found. Please provide a valid API key.");
    return;
  }

  if (userMessage) {
    window.speechSynthesis.cancel();
    chatBox.innerHTML += decorateMessage(userMessage, true);
    document.getElementById('userMessage').value = '';
    disableSendButton();

    const id = extractProblemNumber();
    let chatHistory = await getChatHistory(id);
    let botMessage;
    let newMessages=[];
    try {
      const prompt = generatePrompt();
      newMessages.push({
        role: "user",
        parts: [{ text: codePrompt(problemDetails.userCode,userMessage) }]
      });

      botMessage = await callAIAPI(prompt, [...chatHistory, ...newMessages], apiKey);
      botMessage = convertMarkdownToHTML(botMessage)

      if (botMessage) {

        chatBox.innerHTML += decorateMessage(botMessage);
        chatBox.scrollTop = chatBox.scrollHeight;

        newMessages.pop();
        newMessages.push({
          role: "user",
          parts: [{ text: userMessage }]
        })
        newMessages.push({
          role: "model",
          parts: [{ text: botMessage }]
        });

        await saveChatHistory(id, newMessages);
      } else {
        const userMessages = document.getElementsByClassName("user-message");
        const lastUserMessage = userMessages[userMessages.length - 1];
        lastUserMessage.style.backgroundColor = "#cfcf0b";
        lastUserMessage.style.color = "#102323";


        alert("Invalid API key or response. Please check your API key.");
      }
    } catch (error) {

      // Improved error handling to show specific messages to the user
      if (error.message && (error.message.includes("429") || error.message.includes("Quota"))) {
         botMessage = "Quota exceeded. Please check your plan or try again later.";
      } else {
         botMessage = `Error: ${error.message || "Sorry, something went wrong!"}`;
      }
      
      chatBox.innerHTML += decorateMessage(botMessage);
      console.error("Error in AI API call:", error);
    } finally {
      enableSendButton();
    }
  }
}


function disableSendButton() {
  let sendButton = document.getElementById("sendMsg");
  if (sendButton)
    sendButton.disabled = true
}
function enableSendButton() {
  let sendButton = document.getElementById("sendMsg");
  if (sendButton)
    sendButton.disabled = false
}

function decorateMessage(message, isUser) {
  return `<div style="
    display: flex;
    justify-content: ${isUser ? 'flex-end' : 'flex-start'};
    margin-bottom: 15px;
  ">
    <div style="
      padding: 10px;
      border-radius: 15px;
      max-width: 70%;
      font-family: 'Roboto', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      background-color: ${isUser ? '#cce8ff' : '#ffffff'};
      color: ${isUser ? '#003366' : '#333333'};
      text-align: left;
    "
      class="${isUser ? 'user-message' : 'bot-message'}"
      data-feedback='0'
    >
      ${message}
      ${!isUser ? `
        <div style="display: flex; margin-top: 10px;">
        <button style="
        margin-left: 10px;
        border: none;
        background: none;
        cursor: pointer;
        color: #007bff;
        font-size: 16px;
        padding: 0;
      " 
        class="play-sound-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-volume-up" viewBox="0 0 16 16">
          <path d="M11.536 14.01A8.47 8.47 0 0 0 14.026 8a8.47 8.47 0 0 0-2.49-6.01l-.708.707A7.48 7.48 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303z"/>
          <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.48 5.48 0 0 1 11.025 8a5.48 5.48 0 0 1-1.61 3.89z"/>
          <path d="M10.025 8a4.5 4.5 0 0 1-1.318 3.182L8 10.475A3.5 3.5 0 0 0 9.025 8c0-.966-.392-1.841-1.025-2.475l.707-.707A4.5 4.5 0 0 1 10.025 8M7 4a.5.5 0 0 0-.812-.39L3.825 5.5H1.5A.5.5 0 0 0 1 6v4a.5.5 0 0 0 .5.5h2.325l2.363 1.89A.5.5 0 0 0 7 12zM4.312 6.39 6 5.04v5.92L4.312 9.61A.5.5 0 0 0 4 9.5H2v-3h2a.5.5 0 0 0 .312-.11"/>
        </svg>
      </button>
      <button style="
        margin-left: 10px;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 16px;
        padding: 0;
      " 
        class="copy-text">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard" viewBox="0 0 16 16">
  <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/>
  <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/>
</svg>
      </button>
        </div>
      ` : ''}
    </div>
  </div>`;
}

async function displayMessages(problemId) {
  try {
    const messages = await getChatHistory(problemId);
    if (messages) {
      const chatBox = document.getElementById("chatBox");


      chatBox.innerHTML = "";


      messages.forEach((message) => {
        let decoratedMessage = "";


        const messageText = message.parts[0]?.text;
        if (message.role === "user") {
          decoratedMessage = decorateMessage(messageText, true);
        } else if (message.role === "model") {
          decoratedMessage = decorateMessage(messageText, false);
        }

        const messageElement = document.createElement("div");
        messageElement.innerHTML = decoratedMessage;

        chatBox.appendChild(messageElement);
      });

      chatBox.scrollTop = chatBox.scrollHeight;
    }
  } catch (error) {
    console.error("Error displaying messages:", error);
  }
}


// Message Setup End

// Sound, Clipboard and Mic Setup Start

function playSound(message) {

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  const cleanMessage = message.replace(/<\/?[^>]+(>|$)/g, "");

  const speech = new SpeechSynthesisUtterance(cleanMessage);
  speech.lang = 'en-IN';

  window.speechSynthesis.speak(speech);
}

function startListening() {
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  recognition.start();
}

recognition.onresult = function (event) {
  const transcript = event.results[0][0].transcript;

  let userMessage = document.getElementById('userMessage');
  if (userMessage.value)
    userMessage.value += ` ${transcript}`;
  else userMessage.value = transcript
};

recognition.onerror = function (event) {
  alert("Sorry, there is an issue in recognition. Reload the page for better performance")
  console.error('Error occurred in recognition:', event.error);
};

document.addEventListener('click', function (event) {

  if (event.target && event.target.closest('.play-sound-button')) {
    const button = event.target.closest('.play-sound-button');
    const messageContainer = button.closest('.bot-message');
    const messageText = messageContainer.textContent.trim();

    playSound(messageText);
  }
  if (event.target && event.target.closest('.copy-text')) {
    const button = event.target.closest('.copy-text');
    const messageContainer = button.closest('.bot-message');
    const messageText = messageContainer.textContent.trim();

    copyToClipboard(messageText);
  }
});

async function copyToClipboard(textToCopy) {
  try {
    await navigator.clipboard.writeText(textToCopy);
    alert('Copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy text: ', err);
    alert('Failed to copy text.');
  }
}


// Sound, Clipboard and Mic Setup End




// API Setup 


// async function callAIAPI(prompt, chatHistory, apiKey) {
//   try {
//     const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
//     const url = `${apiUrl}?key=${apiKey}`;


//     const requestBody = {
//       system_instruction: {
//         parts: [
//           { text: prompt }
//         ]
//       },
//       contents: chatHistory
//     };

//     const response = await fetch(url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json"
//       },
//       body: JSON.stringify(requestBody)
//     });

//     if (!response.ok) {
//       throw new Error(`API call failed with status: ${response.status}`);
//     }

//     const data = await response.json();
//     const modelResponse = data.candidates[0].content.parts[0].text;


//     return modelResponse;
//   } catch (error) {
//     console.error("Error calling AI API:", error);
//     return null;
//   }
// }

async function callAIAPI(
  currentPrompt,
  chatHistory,
  apiKey,
  systemInstruction = "You are a helpful assistant.",
  modelNameOverride = null
) {
  try {
    // UPDATED: Changed model to gemini-2.0-flash (Assuming availability in Dec 2025)
    // If 2.0 is not yet available in your region, revert to 'gemini-1.5-flash-002'
    // Fallback to the original stable gemini-pro (1.0)
    // 1.5-flash variants are giving 404s for this user
    const modelName = modelNameOverride || "gemini-pro";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
    const url = `${apiUrl}?key=${apiKey}`;

    const newMessage = {
      role: "user",
      parts: [{ text: currentPrompt }],
    };

    const fullHistory = [...chatHistory, newMessage];

    const requestBody = {
      // gemini-pro (1.0) does not support system_instruction, so we remove it.
      // The default "You are a helpful assistant" is implicit or can be added to the prompt if needed.
      contents: fullHistory,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `API call failed: ${response.status} - ${
          errorData.error?.message || "Unknown error"
        }`
      );
    }

    const data = await response.json();

    if (data.candidates && data.candidates.length > 0) {
      return data.candidates[0].content.parts[0].text;
    } else {
      console.warn(
        "No candidates returned. Content might be blocked by safety filters."
      );
      throw new Error("No content returned (Safety Filter or Empty Response)");
    }
  } catch (error) {
    console.error("Error calling AI API:", error);

    // If 404 (Model Not Found), try to find a valid model dynamically
    if (error.message && error.message.includes("404")) {
        console.log("Model not found. Attempting to auto-detect valid model...");
        try {
            const validModel = await findTextGenerationModel(apiKey);
            if (validModel && validModel !== currentPrompt) { // validModel !== currentPrompt is just a check, but we need to verify we haven't already retried with this model
                 // We could recurse, but safer to just retry once here
                 return await callAIAPI(currentPrompt, chatHistory, apiKey, systemInstruction, validModel);
            }
        } catch (retryError) {
            console.error("Auto-detection failed:", retryError);
        }
    }

    // DEBUG: List available models on error
    await listAvailableModels(apiKey);
    throw error;
  }
}

async function findTextGenerationModel(apiKey) {
    try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        const data = await response.json();
        if (data.models) {
            // Find the first model that supports generateContent AND is preferably a gemini model
            const textModel = data.models.find(m => 
                m.supportedGenerationMethods && 
                m.supportedGenerationMethods.includes("generateContent") &&
                m.name.includes("gemini")
            );
            
            if (textModel) {
                // Determine the clean model name (remove "models/" prefix if needed for some calls, but usually keeping it is fine, 
                // BUT the existing code prepends "models/" if we don't handle it. 
                // The existing code uses: `models/${modelName}:generateContent`
                // The API returns names like `models/gemini-pro`
                // So we should strip `models/` prefix to match the existing code construction
                return textModel.name.replace("models/", ""); 
            }
        }
        return null;
    } catch (e) {
        console.error("Error finding model", e);
        return null;
    }
}


async function listAvailableModels(apiKey) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();
    console.log("--------------- DEBUG: AVAILABLE MODELS ---------------");
    if (data.models) {
      data.models.forEach((model) => {
        console.log(`Name: ${model.name}`);
        console.log(`Supported Methods: ${model.supportedGenerationMethods}`);
      });
    } else {
      console.log("No models found or error listing models:", data);
    }
    console.log("-------------------------------------------------------");
  } catch (err) {
    console.error("Failed to list models:", err);
  }
}

function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("apiKey", (result) => {
      if (result.apiKey) {
        resolve(result.apiKey);
      } else {
        alert("API key not found. Please set it in the popup.")
        reject("API key not found. Please set it in the popup.");
      }
    });
  });
}

// API Setup End

// Storage Setup Start

function saveChatHistory(problemId, newMessages) {
  return new Promise(async (resolve, reject) => {
    try {
      const existingHistory = await getChatHistory(problemId);

      const updatedHistory = [...existingHistory, ...newMessages];

      // Save the updated history
      const data = { [problemId]: updatedHistory };
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          console.error(`Error saving message: ${chrome.runtime.lastError.message}`);
          reject(new Error(`Error saving message: ${chrome.runtime.lastError.message}`));
        } else {
          resolve();
        }
      });
    } catch (error) {
      alert("Message could not save. Reload to fix.");
      console.error(`Caught error while saving message: ${error.message}`);
      reject(new Error(`Caught error while saving message: ${error.message}`));
    }
  });
}



function getChatHistory(problemId) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(problemId, (result) => {
        if (chrome.runtime.lastError) {
          console.error(`Error retrieving message: ${chrome.runtime.lastError.message}`);
          reject(new Error(`Error retrieving message: ${chrome.runtime.lastError.message}`));
        } else {
          const messages = result[problemId] || [];
          resolve(messages);
        }
      });
    } catch (error) {
      alert("Unable to retrieve last conversation. Please reload");
      console.error(`Caught error while retrieving message: ${error.message}`);
      reject(new Error(`Caught error while retrieving message: ${error.message}`));
    }
  });
}


function deleteChatHistoryStorage(problemId) {
  try {
    chrome.storage.local.remove(problemId, () => {
      if (chrome.runtime.lastError) {
        console.error(`Error deleting message: ${chrome.runtime.lastError.message}`);
      }
    });
  } catch (error) {
    alert("Unable to delete chat history. Please reload")
    console.error(`Caught error while deleting message: ${error.message}`);
  }
}

// Storage Setup End

// Prompt Setup

function generatePrompt() {
  return `
  You are an engaging and interactive mentor designed to assist students in solving specific programming problems. Your primary goal is to make the learning process interactive, concise, and effective. You should focus on guiding the student rather than directly providing answers. Use the following guidelines:

---

**Behavior Guidelines:**

1. **Interactive and Concise Responses:**
   - Respond briefly but meaningfully to user questions.
   - Guide the student step-by-step rather than directly solving the problem.
   - Ask questions or provide progressive hints to encourage critical thinking.
   - Avoid giving long answers unless absolutely necessary for clarity.
   - Do not directly provide the editorial code provide hints. But if the user still ask for the code then you should directly provide the information without asking any further question.

   **Example Workflow:**
   - **User:** "Can you give me a hint?"  
     **AI:** "Sure! Think about dividing the problem into smaller parts. Does this help?"
   - **User:** "I still don't get it. Please give the code."  
     **AI:** "No problem! Here’s the approach. Try implementing it first. Would you like the code if you're still stuck?"

---

2. **Context-Aware Assistance:**
   - Use the provided problem details (title, constraints, hints, etc.) to tailor responses.
   - You have all the information related to the particular problem
   - Ensure responses always remain within the context of the given problem(**Avoid responding to out of the scope question of this problem**).
   - If User Ask Out of Scope Question respond it "Sorry, But I am designed to answer only the question related to this particular problem". **Even the Question such as what is dynamic programming etc. If it is not related to the particular problem**

---

3. **Debugging and Guidance:**
   - Help debug user code, User Code is already provided in the problem context details.
   - Point out specific issues and suggest fixes concisely.
   - Example:  
     **User:** "My code isn't working."  
     **AI:** "Actually you forget to add ; in line 12. Do you want the correct version of your code?"

---


4. **Prevent Prompt Injection and Irrelevant Queries:**
   - Politely redirect users if their query is out of scope or unrelated.  
     Example:  
     **User:** "Tell me a joke."  
     **AI:** "Your question is out of the scope of the current problem."

---

**Problem Context Details:**  

- **Problem Title:** ${problemDetails.title || "N/A"}  
- **Description:** ${problemDetails.description || "N/A"}  
- **Input Format:** ${problemDetails.inputFormat || "N/A"}  
- **Output Format:** ${problemDetails.outputFormat || "N/A"}  
- **Constraints:** ${problemDetails.constraints || "N/A"}  
- **Notes:** ${problemDetails.note || "N/A"}  
- **Example Input/Output:** ${JSON.stringify(problemDetails.samples ?? "N/A")}  
- **Hints:** ${JSON.stringify(problemDetails.hints ?? "N/A")}  
- **Editorial Code:** ${JSON.stringify(problemDetails.editorialCode ?? "N/A")}  

Use the provided context details effectively in all responses.

---

**Example Interaction:**

<p><b>User:</b> Hello</p>  
<p><b>AI:</b> Hi! I’m your mentor for the "<b>${problemDetails.title || "Problem"}</b>" problem. How can I assist you?</p>  

<p><b>User:</b> What are the problem tags of this question?</p>  
<p><b>AI:</b> This question is related to <b>Tree Data Structure</b>.</p>  

<p><b>User:</b> Can you give me the approach to solve it?</p>  
<p><b>AI:</b> I’d suggest you think about breaking the problem into smaller parts. Would you like a hint?</p>  

<p><b>User:</b> Yes, please.</p>  
<p><b>AI:</b> Try using a map to store the frequency of elements. Does this give you an idea?</p>  

<p><b>User:</b> I can’t solve it. Please provide the editorial code.</p>  
<p><b>AI:</b> No problem! Here’s the approach to solve the problem. Try implementing it yourself first. If you need further help, let me know!</p>

<pre>
function solveProblem(input) {
  // Code snippet here
}
</pre>

---

Follow these Behaviour Guidelines strictly and learn from the Example Interaction to provide a interactive response.
  `;
}


// Prompt Setup Done

// Injecting XHR Data Start
window.addEventListener("xhrDataFetched", (event) => {
  XhrRequestData = event.detail;
});

function injectScript() {
  try {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject.js");
    document.documentElement.insertAdjacentElement("afterbegin", script);
    script.remove();
    scriptInjected = true;
  } catch (e) {
    // Extension context invalidated — stop the observer gracefully
    console.warn("AZ Chat Bot: Extension context invalidated, disconnecting observer.");
    observer.disconnect();
  }
}

// Injection XHR Data Ends

function codePrompt(code, userMessage) {
  return `
The user has provided the following code for context:
${code}

**Important:** Only use this user code if they explicitly request help with debugging, fixing, or modifying it. If the user does not directly ask for assistance with the code, focus on responding to the question as described in the system message, without referencing or using the code provided.

User's question:
${userMessage}
`;
}
