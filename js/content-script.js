// 注入页面的JS
console.log("SinRiuPayPal-HomePage支付脚本注入成功")

const WaitEleTimes = 30
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

// 等待某个元素加载完成, 再执行任务
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

function waitAnyEleDom(selectorArray, times, interval) {
    /**
     *@desc 等待任意个元素中的某个元素加载完成
     *@param {array} selectorArray JS选择器列表
     *@param {int} times 重试次数
     *@param {int} interval 重试时间间隔 
     */
    StepDoing = true
    let _times = times || -1,
        _interval = interval || 500,
        _iIntervalID // 定时器ID

    return new Promise(function(resolve, reject) {
        _iIntervalID = setInterval(function() {
            if (!_times) {
                clearInterval(_iIntervalID)
                reject(new Error('元素获取超时'))
            }
            _times <= 0 || _times-- //如果是正数就 --
            for (let i = 0; i < selectorArray.length; i++) {
                let _selector = selectorArray[i]
                let _eleDom = document.querySelector(_selector)
                if (_eleDom !== null) {
                    clearInterval(_iIntervalID)
                    resolve(_eleDom)
                    return
                }
            }

        }, _interval)
    })
}

function eleDomDispatchEvent(eleDom, eventName) {
    // eleDom: 元素DOM对象
    // eventName: 事件名称
    let _ev = document.createEvent('HTMLEvents')
    _ev.initEvent(eventName, true, true)
    eleDom.dispatchEvent(_ev)
}

function sleep(time) {
    // time: 睡眠时间, 毫秒(ms)
    var startTime = new Date().getTime() + parseInt(time, 10);
    while (new Date().getTime() < startTime) {}
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
async function backExecRse(_step, _ok, data, callback) {
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
        data: JSON.stringify(params),
        dataType: 'json',
        contentType: 'application/json',
        success: function(resp) {
            if (resp.errcode === 0) {
                // console.log("back exec res resp:", resp)
                return callback ? callback() : null
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
            await step3Plus(taskInfo.currency) // 选择收款币种
            break
        case 4:
            sleep(1500) // 强制睡眠1.5s
            await step4Plus(taskInfo.amount) // 填写收款金额
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
            await step8(taskInfo.currency, taskInfo.amount) // 提取实付信息, 当收款币种与实付币种不一样时还要检查汇率换算值
            break
        case 9:
            await step9() // 点击支付按钮
            break
        case 10:
            await step10() // 支付结果截图
            break
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

const submitAccountBtnSelector = 'button[data-nemo="submit"]'

// 提交收款账号
async function step2() {
    waitEleDom(submitAccountBtnSelector).then(async function(eleDom) {
        await backExecRse(2, true, null)
        eleDomDispatchEvent(eleDom, 'click')
    }).catch(async function() {
        await backExecRse(2, false, null)
    })
}

// 交换步骤 3/4 , 强制先选择币种, 再填写金额
const currencySelector =
    "#react-transfer-container > div > div > form > div > div:nth-child(2) > div.css-nenkzu > div.css-vljigy > div > div.ppaf-select-wrapper > select"
const currencySelectorBack =
    "#react-transfer-container > div > div > form > div > div:nth-child(2) > div.pp-amount-field.basic-v2-big-font > div.ppaf-select-wrapper > select"

// 选择收款币种
async function step3(_currency) {
    _waitEleDom(currencySelector, 5, 1000).then(async function(eleDom) {
        eleDom.value = _currency
        eleDomDispatchEvent(eleDom, 'change')
        await backExecRse(3, true, null)
    }).catch(async function() {
        console.log('step3 into back way')
        await step4back(_currency)
    })
}

// 备选步骤3
async function step3back(_currency) {
    waitEleDom(currencySelectorBack).then(async function(eleDom) {
        eleDom.value = _currency
        eleDomDispatchEvent(eleDom, 'change')
        await backExecRse(3, true, null)
    }).catch(async function() {
        console.log('step3 back way alse fail')
        await backExecRse(3, false, null)
    })
}

// 优化级步骤3
async function step3Plus(_currency) {
    waitAnyEleDom(
        [currencySelector, currencySelectorBack], WaitEleTimes, WaitEleInterval
    ).then(async function(eleDom) {
        eleDom.value = _currency
        eleDomDispatchEvent(eleDom, 'change')
        await backExecRse(3, true, null)
    }).catch(async function() {
        console.log('step3Plus alse fail')
        await backExecRse(3, false, null)
    })
}

// 填写收款金额
async function step4(_amount) {
    _waitEleDom("#fn-recipientGetsAmount", 5, 1000).then(async function(eleDom) {
        eleDom.value = _amount
        eleDomDispatchEvent(eleDom, 'input')
        await backExecRse(4, true, null)
    }).catch(async function() {
        console.log("step4 into back way")
        await step3Back(_amount)
    })
}

// 备选步骤4
async function step4Back(_amount) {
    waitEleDom('#fn-amount').then(async function(eleDom) {
        eleDom.value = _amount
        eleDomDispatchEvent(eleDom, 'input')
        await backExecRse(4, true, null)
    }).catch(async function() {
        console.log('step3 back way also fail')
        await backExecRse(4, false, null)
    })
}

// 优化级步骤4, 尝试同时获取多个Dom对象中的任意一个
async function step4Plus(_amount) {
    waitAnyEleDom(['#fn-recipientGetsAmount', '#fn-amount'], WaitEleTimes, WaitEleInterval).then(async function(
        eleDom) {
        eleDom.value = _amount
        eleDomDispatchEvent(eleDom, 'input')
        await backExecRse(4, true, null)
    }).catch(async function() {
        console.log('step4Plus step fail')
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

// 提取实付金额与币种, 当收款币种与实付币种不一样时, 需要检查汇率换算的值是否在限制范围内, 目前上限设置为1个货币单位
const realPayInfoSelector =
    '#react-transfer-container > div > div > form > div.preview-fundingOptions-wrapper._al5qkz > div:nth-child(2) > div > div > span > span._140n9qh.col-xs-7.totalAmount.col-xs-5.txtAlignRight.test_senderPay'
const convertCurrencyRateSelector =
    '#react-transfer-container > div > div > form > div.preview-fundingOptions-wrapper._al5qkz > div.currencyConversion.clearfix > div > div:nth-child(1) > span > span > span > span'
async function step8(receipt_currency, receipt_amount) {
    let params = {}
    waitEleDom(realPayInfoSelector).then(async function(eleDom) {
        let currency_rate_check = false
        try {
            let raw_str_array = eleDom.textContent.split('\xa0')
            params.pay_amount = raw_str_array[0].slice(1)
            params.pay_currency = raw_str_array[1]
            // 当收款币种与实付币种不一样时, 需要检查汇率换算的值是否在限制范围内, 目前上限设置为1个货币单位
            if (receipt_currency != params.pay_currency) {
                currency_rate_check = true
                await waitEleDom(convertCurrencyRateSelector).then(async function(currencyRateDom) {
                    let rate = currencyRateDom.textContent.split(' ')[0]
                    params.currency_rate = rate
                }).catch(async function(err) {
                    console.log("获取汇率失败")
                    console.log(err)
                })
            }
            if (currency_rate_check && !params.currency_rate) {
                await backExecRse(8, false, null)
                return
            }
            await backExecRse(8, true, params)
        } catch (err) {
            console.log(err)
            await backExecRse(8, false, null)
            return
        }
    }).catch(async function() {
        await backExecRse(8, false, null)
    })
}

// 最终付款确认
const finalSubmitSelector = '#react-transfer-container > div > div > form > button.css-1mggxor.vx_btn'
const finalFormSelector = '#react-transfer-container > div > div > form'
const finalFormAvatarSvg =
    '#react-transfer-container > div > div > form > div.css-1dlk8iw > div.css-1uv1ykq > div.css-12m5src.recipientHeader > div > div > div > svg'

// 将付款预览表单截图发送到后端, 返回成功后再点击确认支付按钮
async function step9() {
    let params = {}
    // 先尝试获取最终提交表单的预览图
    await waitEleDom(finalFormSelector).then(async function(fromDom) {
        // 使用await保证先处理好头像
        await waitEleDom(finalFormAvatarSvg).then(async function(svgDom) {
            svgDom.setAttribute("width", svgDom.getBoundingClientRect().width);
            svgDom.style.width = null;
            svgDom.setAttribute("height", svgDom.getBoundingClientRect().height);
            svgDom.style.height = null;
        })
        // 处理滚动条, 将截图完全展示
        window.pageYOffset = 0
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
        // 将表单元素转换为图片
        await html2canvas(fromDom).then(async function(canvas) {
            params.b64url = canvas.toDataURL("image/png").toString();
            if (params.b64url.indexOf("image/png;base64") < 0 || params.b64url.length <
                50) {
                console.log("获取最终提交表单截图失败")
                console.log(params.b64url)
                params.b64url = null
                return
            }
            console.log("获取最终提交表单截图成功")
        }).catch(async function(err) {
            console.log("获取最终提交表单截图失败")
            console.log(err);
        })
    })

    // 向后端提交表单预览图, 本地后端返回成功后才点击确认支付按钮
    waitEleDom(finalSubmitSelector).then(async function(eleDom) {
        await backExecRse(9, true, params,
            function() {
                eleDomDispatchEvent(eleDom, 'click')
                eleDom.click()
            }
        )
    }).catch(async function() {
        await backExecRse(9, false, null)
    })

}

// 付款结果截图 !2020-10-23 网站更新,去掉了SVG
// const payResImgSvg = '#success-checkmark-animated > svg'
const payResImgSelector = "#react-transfer-container > div > div > div"
const payResWaitTag = "#react-transfer-container > div > div > div > div.doneLinks > a"

async function step10() {
    let params = {}
    // 等待标志性元素加载完成
    let waitOk = true;
    await waitEleDom(payResWaitTag).then().catch(function() {
        waitOk = false;
    })
    if (!waitOk) {
        await backExecRse(10, false, null)
        alert("未找到支付成功标志性元素, 保存付款截图失败!!!, 请手动截图!!!")
        return
    }
    console.log("获取截图标志性元素成功!")

    waitEleDom(payResImgSelector).then(async function(eleDom) {
        // let handledSvgOk = true
        // // 使用await保证先处理好SVG !2020-10-23 网站更新,去掉了SVG
        // await waitEleDom(payResImgSvg).then(async function(svgDom) {
        //     svgDom.setAttribute("width", svgDom.getBoundingClientRect().width);
        //     svgDom.style.width = null;
        //     svgDom.setAttribute("height", svgDom.getBoundingClientRect().height);
        //     svgDom.style.height = null;
        // }).catch(function() {
        //     handledSvgOk = false
        // })

        // if (!handledSvgOk) {
        //     await backExecRse(10, false, null)
        //     alert("处理SVG图片出错, 保存付款截图失败!!!, 请手动截图!!!")
        //     return
        // }

        // 处理滚动条, 将截图完全展示
        window.pageYOffset = 0
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0

        html2canvas(eleDom).then(async function(canvas) {
            params.b64url = canvas.toDataURL("image/png");
            if (params.b64url.indexOf("image/png;base64") < 0 || params.b64url.length <
                50) {
                await backExecRse(10, false, null)
                alert("生成的图片BS64字符串错误!!, 保存付款截图失败!!!, 请手动截图!!!")
                console.log(params.b64url)
                return
            }
            await backExecRse(10, true, params)
        }).catch(async function(err) {
            console.log(err);
            await backExecRse(10, false, null)
            alert("转换图片失败!!, 保存付款截图失败!!!, 请手动截图!!!")
        })
    }).catch(async function(err) {
        console.log(err)
        await backExecRse(10, false, null)
        alert("获取图片区域元素失败!!, 保存付款截图失败!!!, 请手动截图!!!")
    })
}
