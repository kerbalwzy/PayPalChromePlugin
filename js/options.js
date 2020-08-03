// 插件配置JS
let ele = document.getElementById('stepfrequency')

chrome.storage.sync.get({
	SinRiuPayPalStepSec: 2000
}, function(item) {
	console.log(item.SinRiuPayPalStepSec)
	ele.value = (parseInt(item.SinRiuPayPalStepSec) / 1000).toString()
})

ele.onmouseout = function() {
	if (ele.value === '') {
		ele.value = 2
	}

	let _sec = parseInt(ele.value);
	if (!_sec || _sec < 1) {
		console.log(_sec)
		_sec = 1
		ele.value = _sec
	}

	let _sec_mil = _sec * 1000
	chrome.storage.sync.set({
		SinRiuPayPalStepSec: _sec_mil
	})
}
