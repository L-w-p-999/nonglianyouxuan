const WXAPI = require('apifm-wxapi')
const AUTH = require('../../utils/auth')
//获取应用实例
var app = getApp()
Page({
	data: {
		showRegionStr: '请选择',
		wxlogin: true,
		wxaddress: null, // 微信地址数据
		addressData: null, // 编辑时的地址数据
		pObject: null,
		cObject: null,
		dObject: null,
	},
	onShow(){
		AUTH.checkHasLogined(isLogined => {
			this.setData({
				wxlogin: isLogined
			})
		})
	},
	async bindSave(e) {
		var that = this;
		var linkMan = e.detail.value.linkMan;
		var address = e.detail.value.address;
		var mobile = e.detail.value.mobile;
		const code = '322000';
		
		if (linkMan == "") {
			wx.showModal({
				title: '提示',
				content: '请填写联系人姓名',
				showCancel: false
			})
			return
		}
		if (mobile == "") {
			wx.showModal({
				title: '提示',
				content: '请填写手机号码',
				showCancel: false
			})
			return
		}
		if (!this.data.id && !this.data.pObject && !this.data.cObject && !this.data.wxaddress) {
			// 只有在既没有手动选择地区，也没有微信地址时才提示
			wx.showModal({
				title: '提示',
				content: '请选择地区',
				showCancel: false
			})
			return
		}
		if (address == "") {
			wx.showModal({
				title: '提示',
				content: '请填写详细地址',
				showCancel: false
			})
			return
		}
		
		const postData = {
			token: wx.getStorageSync('token'),
			linkMan: linkMan,
			address: address,
			mobile: mobile,
			code: code,
			isDefault: 'true',
		}
		
		// 优先使用手动选择的地区ID
		if (this.data.pObject) {
			postData.provinceId = this.data.pObject.id
		}
		if (this.data.cObject) {
			postData.cityId = this.data.cObject.id
		}
		if (this.data.dObject) {
			postData.districtId = this.data.dObject.id
		}
		
		// 如果没有ID但有微信地址，使用地区名称
		if (!postData.provinceId && this.data.wxaddress) {
			// 尝试通过名称查找ID，如果找不到就用固定ID或留空
			// 这里使用一个通用的省市区ID，你需要根据实际情况调整
			postData.provinceId = 0 // 或者根据 provinceName 映射
			postData.cityId = 0
			postData.districtId = 0
			
			// 将完整地区信息放到 extJsonStr 中
			const extJsonStr = {
				'省份': this.data.wxaddress.provinceName,
				'城市': this.data.wxaddress.cityName,
				'区县': this.data.wxaddress.countyName
			}
			postData.extJsonStr = JSON.stringify(extJsonStr)
			
			// 或者把地区信息拼接到详细地址中
			postData.address = this.data.wxaddress.provinceName + 
			                   this.data.wxaddress.cityName + 
			                   this.data.wxaddress.countyName + 
			                   address
		}
		if (this.data.selectRegion && this.data.selectRegion.length > 3) {
			const extJsonStr = {}
			let _address = ''
			for (let i = 3; i < this.data.selectRegion.length; i++) {
				_address += this.data.selectRegion[i].name
			}
			extJsonStr['街道/社区'] = _address
			postData.extJsonStr = JSON.stringify(extJsonStr)
		}
		
		let apiResult
		if (that.data.id) {
			postData.id = this.data.id
			apiResult = await WXAPI.updateAddress(postData)
		} else {
			apiResult = await WXAPI.addAddress(postData)
		}
		if (apiResult.code != 0) {
			wx.hideLoading();
			wx.showToast({
				title: apiResult.msg,
				icon: 'none'
			})
			return;
		} else {
			wx.showToast({
				title: '保存成功',
				icon: 'success'
			})
			setTimeout(() => {
				wx.navigateBack()
			}, 1500)
		}
	},
	onLoad: function(e) {
		const _this = this
		if (e.id) { // 修改初始化数据库数据
			WXAPI.addressDetail(wx.getStorageSync('token'), e.id).then(function(res) {
				if (res.code == 0) {
					let showRegionStr = res.data.info.provinceStr + res.data.info.cityStr + res.data.info.areaStr
					if (res.data.extJson && res.data.extJson['街道/社区']) {
						showRegionStr += res.data.extJson['街道/社区']
					}
					_this.setData({
						id: e.id,
						addressData: res.data.info,
						showRegionStr
					});
					return;
				} else {
					wx.showModal({
						title: '提示',
						content: '无法获取快递地址数据',
						showCancel: false
					})
				}
			})
		}
	},
	deleteAddress: function(e) {
		var that = this;
		var id = e.currentTarget.dataset.id;
		wx.showModal({
			title: '提示',
			content: '确定要删除该收货地址吗？',
			success: function(res) {
				if (res.confirm) {
					WXAPI.deleteAddress(wx.getStorageSync('token'), id).then(function() {
						wx.showToast({
							title: '删除成功',
							icon: 'success'
						})
						setTimeout(() => {
							wx.navigateBack({})
						}, 1500)
					})
				}
			}
		})
	},
	
	/**
	 * 读取微信地址 - 核心功能
	 */
	readFromWx() {
		const _this = this
		wx.chooseAddress({
			success: (res) => {
				console.log('微信地址数据：', res)
				
				// 组合显示的地区字符串
				const showRegionStr = res.provinceName + res.cityName + res.countyName
				
				// 设置微信地址数据
				_this.setData({
					wxaddress: res,
					showRegionStr: showRegionStr,
					// 设置一个标记，表示这是从微信读取的地址
					isFromWechat: true
				})
				
				wx.showToast({
					title: '地址读取成功',
					icon: 'success'
				})
			},
			fail: (err) => {
				console.error('读取微信地址失败：', err)
				if (err.errMsg.indexOf('auth deny') !== -1) {
					wx.showModal({
						title: '提示',
						content: '需要授权才能读取微信地址',
						confirmText: '去授权',
						success: (res) => {
							if (res.confirm) {
								wx.openSetting()
							}
						}
					})
				} else {
					wx.showToast({
						title: '读取地址失败',
						icon: 'none'
					})
				}
			}
		})
	},
	
	/**
	 * 根据地区名称获取对应的ID
	 * 调用API获取省市区的ID
	 */
	async getRegionIdsByName(provinceName, cityName, countyName) {
		try {
			console.log('开始查询地区ID：', { provinceName, cityName, countyName })
			
			// 1. 查询省份ID
			const provinceRes = await WXAPI.province()
			if (provinceRes.code === 0) {
				const province = provinceRes.data.find(item => item.name === provinceName)
				if (province) {
					this.setData({ pObject: province })
					console.log('找到省份：', province)
					
					// 2. 查询城市ID
					const cityRes = await WXAPI.city(province.id)
					if (cityRes.code === 0) {
						const city = cityRes.data.find(item => item.name === cityName)
						if (city) {
							this.setData({ cObject: city })
							console.log('找到城市：', city)
							
							// 3. 查询区县ID
							const districtRes = await WXAPI.district(city.id)
							if (districtRes.code === 0) {
								const district = districtRes.data.find(item => item.name === countyName)
								if (district) {
									this.setData({ dObject: district })
									console.log('找到区县：', district)
								} else {
									console.warn('未找到区县：', countyName)
								}
							}
						} else {
							console.warn('未找到城市：', cityName)
						}
					}
				} else {
					console.warn('未找到省份：', provinceName)
				}
			}
			
			console.log('地区ID设置完成：', {
				pObject: this.data.pObject,
				cObject: this.data.cObject,
				dObject: this.data.dObject
			})
			
		} catch (error) {
			console.error('获取地区ID失败：', error)
			wx.showToast({
				title: '地区解析失败，请手动选择',
				icon: 'none',
				duration: 2000
			})
		}
	},
	
	showRegionSelect() {
		this.setData({
			showRegionSelect: true
		})
	},
	closeAddress() {
		this.setData({
			showRegionSelect: false
		})
	},
	selectAddress(e) {
		console.log('选择地区：', e.detail)
		const pObject = e.detail.selectRegion[0]
		const cObject = e.detail.selectRegion[1]
		const dObject = e.detail.selectRegion[2]
		let showRegionStr = ''
		e.detail.selectRegion.forEach(ele => {
			showRegionStr += ele.name
		})
		this.setData({
			pObject: pObject,
			cObject: cObject,
			dObject: dObject,
			showRegionStr: showRegionStr,
			selectRegion: e.detail.selectRegion,
			wxaddress: null // 清空微信地址，使用手动选择的地区
		})
	},
})