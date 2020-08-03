// 后端运行的JS

// 获取当前选项卡ID
function getCurrentTabId(callback) {
	chrome.tabs.query({
		active: true,
		currentWindow: true
	}, function(tabs) {
		if (callback) callback(tabs.length ? tabs[0].id : null);
	});
}

// 向content-script主动发送消息
function sendMessageToContentScript(message, callback) {
	getCurrentTabId((tabId) => {
		chrome.tabs.sendMessage(tabId, message, function(response) {
			if (callback) callback(response);
		});
	});
}

// 监听来自content-script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	console.log('收到来自content-script的消息:', request)
	if (WorkerWs !== null) {
		WorkerWs.send(JSON.stringify(request))
	} else {
		let msg = {
			cmd: "alert",
			params: 'background.js手动content-script.js的消息:' + JSON.stringify(request)
		}
		sendMessageToContentScript(msg, null)
	}
});
