// 注入页面的JS
console.log("SinRiuPayPal-HomePage支付脚本注入成功")

const WaitEleTimes = 10
const WaitEleInterval = 1000
const TaskHost = 'http://127.0.0.1:5678'
const stoppedKey = "SinRuiPluginStopped"
const taskIdKey = "SinRiuPluginTaskId"
var StepDoing = false

sessionStorage.setItem(stoppedKey, 0)

function openUrl(page_url) {
	if (location.href != page_url) {
		location.href = page_url;
	}
}

function _waitEleDom(selector, times, interval) {
	StepDoing = true
	// selector: JS选择器
	// times: 重试次数
	// interval: 重试间隔
	let _times = times || -1,
		_interval = interval || 500,
		_selector = selector,
		_iIntervalID // 定时器ID

	return new Promise(function(resolve, reject) {
		_iIntervalID = setInterval(function() {
			if (!_times) {
				clearInterval(_iIntervalID)
				reject(new Error('元素获取超时'))
			}
			_times <= 0 || _times-- //如果是正数就 --
			let _eleDom = document.querySelector(_selector)
			if (_eleDom !== null) {
				clearInterval(_iIntervalID)
				resolve(_eleDom)
			}
		}, _interval)
	})
}

function waitEleDom(selector) {
	return _waitEleDom(selector, WaitEleTimes, WaitEleInterval)
}

function eleDomDispatchEvent(eleDom, eventName) {
	// eleDom: 元素DOM对象
	// eventName: 事件名称
	let _ev = document.createEvent('HTMLEvents')
	_ev.initEvent(eventName, true, true)
	eleDom.dispatchEvent(_ev)
}

var _TaskId = null

function active() {
	let stopped = sessionStorage.getItem(stoppedKey)
	console.log('active check stopped:', stopped)
	if (stopped === "1") {
		deactivate()
	} else {
		chrome.storage.sync.get({
			SinRiuPayPalStepSec: 2000
		}, function(item) {
			intervalTime = parseInt(item.SinRiuPayPalStepSec)
			console.log('step frequency: ', intervalTime, 'millisecond')
			_TaskId = setInterval(run, intervalTime)
		})
	}
}

active()

function deactivate() {
	console.log('deactivate and clear interval')
	sessionStorage.setItem(stoppedKey, 1)
	clearInterval(_TaskId)
}


// 获取任务信息
async function getTaskInfo() {
	console.log('try to get task info')
	let taskInfo = null
	$.ajax({
		url: TaskHost + '/auto_pay/task',
		type: 'GET',
		async: false,
		dataType: 'json',
		success: function(resp) {
			if (resp.errcode === 0) {
				taskInfo = resp.data
			} else {
				deactivate()
				alert(resp.msg)
			}
		},
		error: function() {
			deactivate()
		}
	})
	return taskInfo
}

// 返回执行步骤结果
async function backExecRse(_step, _ok, data) {
	let taskId = sessionStorage.getItem(taskIdKey)
	let params = {
		task_id: parseInt(taskId),
		step: _step,
		ok: _ok,
		data: data
	}
	console.log('bacl exec res:', params)
	$.ajax({
		url: TaskHost + '/auto_pay/resp',
		type: 'PUT',
		// async: false,
		data: JSON.stringify(params),
		dataType: 'json',
		contentType: 'application/json',
		success: function(resp) {
			if (resp.errcode === 0) {
				// console.log("back exec res resp:", resp)
			} else {
				deactivate()
				alert(resp.msg)
			}
		},
		error: function() {
			deactivate()
		},
		complete: function() {
			StepDoing = false
		}
	})
}

async function run() {
	let stopped = sessionStorage.getItem(stoppedKey, '0')
	if (stopped === "1") {
		deactivate()
		return
	}
	if (StepDoing) {
		console.log('waiting step doing')
		return
	}
	let taskInfo = await getTaskInfo()
	console.log('taskInfo:', taskInfo)
	if (taskInfo === null) {
		return
	}

	sessionStorage.setItem(taskIdKey, taskInfo.pay_id)
	console.log('task_step', taskInfo.task_step)
	switch (taskInfo.task_step) {
		case 0:
			await step0() // 进入支付主页
			break
		case 1:
			await step1(taskInfo.recipient) // 填写收款账号
			break
		case 2:
			await step2() // 确认收款账号
			break
		case 3:
			await step3(taskInfo.amount) // 填写收款金额
			break
		case 4:
			await step4(taskInfo.currency) // 选择收款币种
			break
		case 5:
			await step5(taskInfo.note) // 填写付款备注
			break
		case 6:
			await step6() // 提交收款详情
			break
		case 7:
			await step7() // 检查金额比重
			break
		case 8:
<<<<<<< HEAD
			await step8() // 提取实付信息
			break
			// case 9:
			// 	await step9()
			// 	break
			// case 10:
			// 	await step10()
			// 	break
=======
			await step8()
			// await testStep8() // 测试步骤8, 截图
			break
		// case 9:
		// 	await step9()
		// 	break
		// case 10:
		// 	await step10()
		// 	break
>>>>>>> 0fe296304d47c1d5e712637c46219af01905286a
		default:
			console.log('this step is still not achieved')
			clearInterval(_TaskId)
	}
}

// 打开支付主页
async function step0() {
	await backExecRse(0, true, null)
	openUrl('https://www.paypal.com/myaccount/transfer/homepage')
}



// 填写收款账号并点击确认
async function step1(_account) {
	waitEleDom('#fn-sendRecipient').then(async function(eleDom) {
		eleDom.value = _account
		eleDomDispatchEvent(eleDom, 'input')
		await backExecRse(1, true, null)
	}).catch(async function() {
		await backExecRse(1, false, null)
	})
}

const submitAccountBtnSelector =
	"#react-transfer-container > div > div > div > div.css-1s5wvjt > div > div > form > div.css-xcma15 > div > span.recipient-next > button"

// 提交收款账号
async function step2() {
	waitEleDom(submitAccountBtnSelector).then(async function(eleDom) {
		await backExecRse(2, true, null)
		eleDomDispatchEvent(eleDom, 'click')
	}).catch(async function() {
		await backExecRse(2, false, null)
	})
}

// 填写收款金额
async function step3(_amount) {
	_waitEleDom("#fn-recipientGetsAmount", 2, 1000).then(async function(eleDom) {
		eleDom.value = _amount
		eleDomDispatchEvent(eleDom, 'input')
		await backExecRse(3, true, null)
	}).catch(async function() {
		console.log("step3 into back way")
		await step3Back(_amount)
	})
}

// 备选步骤3
async function step3Back(_amount) {
	waitEleDom('#fn-amount').then(async function(eleDom) {
		eleDom.value = _amount
		eleDomDispatchEvent(eleDom, 'input')
		await backExecRse(3, true, null)
	}).catch(async function() {
		console.log('step3 back way also fail')
		await backExecRse(3, false, null)
	})
}

const currencySelector =
	"#react-transfer-container > div > div > form > div > div:nth-child(2) > div.css-nenkzu > div.css-vljigy > div > div.ppaf-select-wrapper > select"

// 选择收款币种
async function step4(_currency) {
	_waitEleDom(currencySelector, 2, 1000).then(async function(eleDom) {
		eleDom.value = _currency
		eleDomDispatchEvent(eleDom, 'change')
		await backExecRse(4, true, null)
	}).catch(async function() {
		console.log('step4 into back way')
		await step4back(_currency)
	})
}

const currencySelectorBack =
	"#react-transfer-container > div > div > form > div > div:nth-child(2) > div.pp-amount-field.basic-v2-big-font > div.ppaf-select-wrapper > select"

// 备选步骤4
async function step4back(_currency) {
	waitEleDom(currencySelectorBack).then(async function(eleDom) {
		eleDom.value = _currency
		eleDomDispatchEvent(eleDom, 'change')
		await backExecRse(4, true, null)
	}).catch(async function() {
		console.log('step4 back way alse fail')
		await backExecRse(4, false, null)
	})
}

// 填写收款备注
async function step5(_note) {
	waitEleDom("#noteField").then(async function(eleDom) {
		eleDom.value = _note
		eleDomDispatchEvent(eleDom, 'input')
		await backExecRse(5, true, null)
	}).catch(async function() {
		await backExecRse(5, false, null)
	})
}

const submitAmountBtn = "#react-transfer-container > div > div > form > button.css-1mggxor.vx_btn"

// 提交付款详情
async function step6() {
	waitEleDom(submitAmountBtn).then(async function(eleDom) {
		await backExecRse(6, true, null)
		eleDomDispatchEvent(eleDom, 'click')
		eleDom.click() // 不也知道为什么上面的click不生效, TMD
	}).catch(async function() {
		await backExecRse(6, false, null)
	})
}

// 核对收款金额币种与警戒金额检查
const checkCurrencySelector =
	'#react-transfer-container > div > div > form > div.css-1dlk8iw > div:nth-child(2) > div.pp-amount-field.basic-v2-big-font > div.ppaf-select-wrapper > select'

async function step7() {
	let params = {}
	waitEleDom("#fn-amount").then(async function(eleDom) {
		params.check_amount = eleDom.value
		waitEleDom(checkCurrencySelector).then(async function(eleDom) {
			params.check_currency = eleDom.value
			await backExecRse(7, true, params)
		}).catch(async function() {
			await backExecRse(7, false, null)
		})
	}).catch(async function() {
		await backExecRse(7, false, null)
	})
}

// 提取实付金额与币种
const realPayInfoSelector =
	'#react-transfer-container > div > div > form > div.preview-fundingOptions-wrapper._al5qkz > div:nth-child(2) > div > div > span > span._140n9qh.col-xs-7.totalAmount.col-xs-5.txtAlignRight.test_senderPay'

async function step8() {
	let params = {}
	waitEleDom(realPayInfoSelector).then(async function(eleDom) {
		try {
			let raw_str_array = eleDom.textContent.split(" ")
			params.pay_amount = raw_str_array[0].slice(1)
			params.pay_currency = raw_str_array[1]
		} catch (err) {
			console.log(err)
			await backExecRse(8, false, null)
			return
		}
		await backExecRse(8, true, params)
	}).catch(async function() {
		await backExecRse(8, false, null)
	})
}

// 最终付款确认
const finalSubmitSelector = '#react-transfer-container > div > div > form > button.css-1mggxor.vx_btn'

async function step9() {
	waitEleDom(finalSubmitSelector).then(async function(eleDom) {
		await backExecRse(9, true, null)
		eleDomDispatchEvent(eleDom, 'click')
		eleDom.click()
	}).catch(async function() {
		await backExecRse(9, false, null)
	})
}

// 付款结果截图
const payResImgSelector = '#react-transfer-container > div > div > div > div._vq73ew'

async function step10() {
	let params = {}
	waitEleDom(payResImgSelector).then(async function(eleDom) {
		html2canvas(eleDom).then(async function(canvas) {
			params.b64url = canvas.toDataURL("image/png");
			await backExecRse(10, true, params)
		}).catch(async function() {
			await backExecRse(10, false, null)
			alert("保存付款截图失败!!!, 请手动截图!!!")
		})
	}).catch(async function() {
		await backExecRse(10, false, null)
		alert("保存付款截图失败!!!, 请手动截图!!!")
	})
}


async function testStep8() {
	let params = {}
	waitEleDom('#react-transfer-container > div > div > form > div.css-1dlk8iw').then(async function(eleDom) {
		html2canvas(eleDom).then(async function(canvas) {
			params.b64url = canvas.toDataURL("image/png");
			await backExecRse(8, true, params)
		}).catch(async function() {
			await backExecRse(8, false, null)
			alert("保存付款截图失败!!!, 请手动截图!!!")
		})
	}).catch(async function() {
		await backExecRse(8, false, null)
		alert("保存付款截图失败!!!, 请手动截图!!!")
	})
}